from flask import request, jsonify, current_app
import os
import datetime
import uuid
import json
import tempfile
import asyncio
from werkzeug.utils import secure_filename

# Import the necessary components from your app
from app.api.accounts import accounts_bp
from app.utils.file_utils import (
    get_accounts, 
    save_accounts, 
    get_account_lists,
    get_accounts_meta,
    save_accounts_meta
)

# Import the necessary Telethon components
try:
    from telethon import TelegramClient
    from telethon.errors import (
        PhoneNumberInvalidError,
        SessionPasswordNeededError,
        PhoneCodeInvalidError,
        PhoneCodeExpiredError
    )
    TELETHON_AVAILABLE = True
except ImportError:
    TELETHON_AVAILABLE = False
    current_app.logger.warning("Telethon not available. Phone and session import will be disabled.")

# Session storage for phone verification
# This will store temporary session data during the verification process
# Format: { 'phone_number': { 'client': TelegramClient, 'phone_code_hash': str, proxy: {...} } }
active_verifications = {}

# Create directory for session files
os.makedirs('saved_sessions', exist_ok=True)

@accounts_bp.route('/import-session', methods=['POST'])
def import_session():
    """Import account from session file and optional JSON data"""
    if not TELETHON_AVAILABLE:
        return jsonify({"error": "Session import is not available (Telethon library missing)"}), 400
    
    # Check if session file is provided
    if 'session_file' not in request.files:
        return jsonify({"error": "No session file provided"}), 400
    
    session_file = request.files['session_file']
    if session_file.filename == '':
        return jsonify({"error": "No session file selected"}), 400
    
    if not session_file.filename.endswith('.session'):
        return jsonify({"error": "File must be a .session file"}), 400
    
    # Get other parameters
    target_list_id = request.form.get('list_id', 'main')
    proxy_id = request.form.get('proxy_id')
    custom_name = request.form.get('name', '')
    
    # JSON file is optional
    json_data = {}
    if 'json_file' in request.files:
        json_file = request.files['json_file']
        if json_file and json_file.filename.endswith('.json'):
            try:
                json_data = json.load(json_file)
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid JSON file"}), 400
    
    # Verify proxy exists
    from app.api.proxies.services import get_proxy_by_id
    proxy = get_proxy_by_id(proxy_id)
    if not proxy:
        return jsonify({"error": "Proxy not found"}), 404
    
    # Check if proxy can accept more accounts
    proxy_accounts = proxy.get('accounts', [])
    if len(proxy_accounts) >= 3:
        return jsonify({"error": "Proxy has reached the maximum number of accounts (3)"}), 400
    
    # Process the session file
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            # Save the session file to a temporary location
            session_path = os.path.join(temp_dir, session_file.filename)
            session_file.save(session_path)
            
            # Extract session name (without extension)
            session_name = os.path.splitext(os.path.basename(session_file.filename))[0]
            
            # Configure proxy for Telethon
            proxy_config = None
            if proxy:
                proxy_type = proxy['type']
                proxy_addr = (proxy['host'], int(proxy['port']))
                proxy_credentials = None
                
                if proxy['username'] and proxy['password']:
                    proxy_credentials = (proxy['username'], proxy['password'])
                
                proxy_config = {
                    'proxy_type': proxy_type,
                    'addr': proxy_addr,
                    'credentials': proxy_credentials
                }
            
            # Load API credentials
            api_id, api_hash = _load_api_credentials()
            
            # Create a permanent session file
            permanent_session_path = os.path.join('saved_sessions', f"{session_name}.session")
            
            # Copy the session file to the permanent location
            with open(session_path, 'rb') as src_file:
                with open(permanent_session_path, 'wb') as dest_file:
                    dest_file.write(src_file.read())
            
            # Connect to Telegram
            client = TelegramClient(
                os.path.join('saved_sessions', session_name),
                api_id,
                api_hash,
                proxy=proxy_config
            )
            
            # Start the client and get user info
            user_info = asyncio.run(_get_user_info_from_session(client))
            
            if not user_info:
                return jsonify({"error": "Failed to get user information from session"}), 400
            
            # Use custom name if provided
            if custom_name:
                user_info['name'] = custom_name
            
            # Create account object
            account_id = str(uuid.uuid4())
            account = {
                "id": account_id,
                "telegram_id": user_info['id'],
                "phone": user_info['phone'],
                "name": user_info['name'],
                "username": user_info['username'],
                "avatar": user_info.get('avatar', f"https://ui-avatars.com/api/?name={user_info['name']}&background=random"),
                "status": "Не проверен",
                "limits": json_data.get('limits', {
                    "daily_invites": 30,
                    "daily_messages": 50
                }),
                "created_at": datetime.datetime.now().isoformat(),
                "cooldown_until": None,
                "list_ids": [target_list_id],
                "list_id": target_list_id,
                "premium": user_info.get('premium', False),
                "proxy_id": proxy_id
            }
            
            # Check if an account with this phone number already exists
            existing_account = None
            if user_info['phone']:
                accounts = get_accounts()
                existing_account = next((acc for acc in accounts if acc.get('phone') == user_info['phone']), None)
            
            if existing_account:
                # Update existing account
                accounts = get_accounts()
                account_index = next((i for i, acc in enumerate(accounts) if acc['id'] == existing_account['id']), None)
                
                if account_index is not None:
                    # Preserve existing account ID
                    account_id = existing_account['id']
                    account['id'] = account_id
                    
                    # Update account
                    accounts[account_index] = account
                    save_accounts(accounts)
                    
                    # Update associated metadata
                    accounts_meta = get_accounts_meta()
                    accounts_meta[account_id] = {
                        "session_path": permanent_session_path,
                        "telegram_id": user_info['id']
                    }
                    save_accounts_meta(accounts_meta)
                    
                    # Update proxy association
                    from app.utils.file_utils import update_account_proxy
                    update_account_proxy(account_id, proxy_id)
                    
                    return jsonify({
                        "success": True,
                        "account": account,
                        "updated": True
                    })
            else:
                # Save new account
                accounts = get_accounts()
                accounts.append(account)
                save_accounts(accounts)
                
                # Save metadata
                accounts_meta = get_accounts_meta()
                accounts_meta[account_id] = {
                    "session_path": permanent_session_path,
                    "telegram_id": user_info['id']
                }
                save_accounts_meta(accounts_meta)
                
                # Update proxy association
                from app.utils.file_utils import update_account_proxy
                update_account_proxy(account_id, proxy_id)
                
                return jsonify({
                    "success": True,
                    "account": account,
                    "updated": False
                })
    
    except Exception as e:
        current_app.logger.error(f"Error in import_session: {str(e)}")
        return jsonify({"error": f"Error importing session: {str(e)}"}), 500


@accounts_bp.route('/request-code', methods=['POST'])
def request_verification_code():
    """Request verification code for phone number import"""
    if not TELETHON_AVAILABLE:
        return jsonify({"error": "Phone import is not available (Telethon library missing)"}), 400
    
    # Get request data
    data = request.json
    
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Basic validation
    phone = data.get('phone')
    proxy_id = data.get('proxy_id')
    
    if not phone:
        return jsonify({"error": "Phone number is required"}), 400
    
    if not proxy_id:
        return jsonify({"error": "Proxy ID is required"}), 400
    
    # Verify proxy exists
    from app.api.proxies.services import get_proxy_by_id
    proxy = get_proxy_by_id(proxy_id)
    if not proxy:
        return jsonify({"error": "Proxy not found"}), 404
    
    # Check if proxy can accept more accounts
    proxy_accounts = proxy.get('accounts', [])
    if len(proxy_accounts) >= 3:
        return jsonify({"error": "Proxy has reached the maximum number of accounts (3)"}), 400
    
    try:
        # Configure proxy for Telethon
        proxy_config = None
        if proxy:
            proxy_type = proxy['type']
            proxy_addr = (proxy['host'], int(proxy['port']))
            proxy_credentials = None
            
            if proxy['username'] and proxy['password']:
                proxy_credentials = (proxy['username'], proxy['password'])
            
            proxy_config = {
                'proxy_type': proxy_type,
                'addr': proxy_addr,
                'credentials': proxy_credentials
            }
        
        # Load API credentials
        api_id, api_hash = _load_api_credentials()
        
        # Format phone number (remove '+' if present)
        phone_number = phone.strip()
        if phone_number.startswith('+'):
            phone_number = phone_number[1:]
        
        # Create a temporary session
        session_path = os.path.join('saved_sessions', f"temp_{phone_number}")
        
        # Create the client
        client = TelegramClient(
            session_path,
            api_id,
            api_hash,
            proxy=proxy_config
        )
        
        # Start the client and send verification code
        result = asyncio.run(_request_code(client, phone_number))
        
        # Store the client in active verifications for later use
        active_verifications[phone_number] = {
            'client': client,
            'phone_code_hash': result['phone_code_hash'],
            'proxy': proxy,
            'proxy_id': proxy_id
        }
        
        return jsonify({
            "success": True,
            "message": "Verification code sent",
            "phone_code_hash": result['phone_code_hash']
        })
    
    except PhoneNumberInvalidError:
        return jsonify({"error": "Invalid phone number format"}), 400
    except Exception as e:
        current_app.logger.error(f"Error in request_verification_code: {str(e)}")
        return jsonify({"error": f"Error requesting verification code: {str(e)}"}), 500


@accounts_bp.route('/verify-code', methods=['POST'])
def verify_code():
    """Verify a phone number with the verification code"""
    if not TELETHON_AVAILABLE:
        return jsonify({"error": "Phone import is not available (Telethon library missing)"}), 400
    
    # Get request data
    data = request.json
    
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Basic validation
    required_fields = ['phone', 'code', 'name', 'proxy_id']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    # Format phone number (remove '+' if present)
    phone_number = data['phone'].strip()
    if phone_number.startswith('+'):
        phone_number = phone_number[1:]
    
    # Check if we have an active verification for this phone
    if phone_number not in active_verifications:
        return jsonify({"error": "No active verification session for this phone number. Please request a code first."}), 400
    
    verification = active_verifications[phone_number]
    client = verification['client']
    phone_code_hash = verification['phone_code_hash']
    proxy_id = verification['proxy_id']
    
    try:
        # Sign in with the code
        user = asyncio.run(_sign_in_with_code(client, phone_number, data['code'], phone_code_hash))
        
        if not user:
            return jsonify({"error": "Failed to sign in with the provided code"}), 400
        
        # Get the final session file path
        session_path = os.path.join('saved_sessions', f"{user.id}.session")
        
        # Create account data
        account_id = str(uuid.uuid4())
        account = {
            "id": account_id,
            "telegram_id": user.id,
            "phone": f"+{phone_number}",
            "name": data['name'],
            "username": data.get('username', ''),
            "avatar": data.get('avatar', f"https://ui-avatars.com/api/?name={data['name']}&background=random"),
            "status": "Не проверен",
            "limits": data.get('limits', {
                "daily_invites": 30,
                "daily_messages": 50
            }),
            "created_at": datetime.datetime.now().isoformat(),
            "cooldown_until": None,
            "list_ids": [data.get('list_id', 'main')],
            "list_id": data.get('list_id', 'main'),
            "premium": getattr(user, 'premium', False),
            "proxy_id": proxy_id
        }
        
        # Check if an account with this phone number already exists
        accounts = get_accounts()
        existing_account = next((acc for acc in accounts if acc.get('phone') == f"+{phone_number}"), None)
        
        if existing_account:
            # Update existing account
            account_index = next((i for i, acc in enumerate(accounts) if acc['id'] == existing_account['id']), None)
            
            if account_index is not None:
                # Preserve existing account ID
                account_id = existing_account['id']
                account['id'] = account_id
                
                # Update account
                accounts[account_index] = account
                save_accounts(accounts)
                
                # Update associated metadata
                accounts_meta = get_accounts_meta()
                accounts_meta[account_id] = {
                    "session_path": session_path,
                    "telegram_id": user.id
                }
                save_accounts_meta(accounts_meta)
                
                # Update proxy association
                from app.utils.file_utils import update_account_proxy
                update_account_proxy(account_id, proxy_id)
                
                # Clean up
                del active_verifications[phone_number]
                
                return jsonify({
                    "success": True,
                    "account": account,
                    "updated": True
                })
        else:
            # Save new account
            accounts.append(account)
            save_accounts(accounts)
            
            # Save metadata
            accounts_meta = get_accounts_meta()
            accounts_meta[account_id] = {
                "session_path": session_path,
                "telegram_id": user.id
            }
            save_accounts_meta(accounts_meta)
            
            # Update proxy association
            from app.utils.file_utils import update_account_proxy
            update_account_proxy(account_id, proxy_id)
            
            # Clean up
            del active_verifications[phone_number]
            
            return jsonify({
                "success": True,
                "account": account,
                "updated": False
            })
    
    except PhoneCodeInvalidError:
        return jsonify({"error": "Invalid verification code"}), 400
    except PhoneCodeExpiredError:
        return jsonify({"error": "Verification code has expired. Please request a new code."}), 400
    except SessionPasswordNeededError:
        return jsonify({"error": "Two-factor authentication is enabled. Please use TData import for this account."}), 400
    except Exception as e:
        current_app.logger.error(f"Error in verify_code: {str(e)}")
        return jsonify({"error": f"Error verifying code: {str(e)}"}), 500


# Helper Functions

async def _get_user_info_from_session(client):
    """Get user information from a Telegram session"""
    try:
        await client.connect()
        
        if not await client.is_user_authorized():
            await client.disconnect()
            return None
        
        # Get user info
        me = await client.get_me()
        
        # Check premium status
        premium = False
        try:
            from telethon.tl.functions.users import GetFullUserRequest
            full_user = await client(GetFullUserRequest(me.id))
            premium = getattr(full_user.full_user, 'premium', False)
        except:
            pass
        
        # Get avatar
        avatar_path = None
        try:
            avatar_path = os.path.join('saved_sessions', f"avatar_{me.id}.jpg")
            await client.download_profile_photo(me, file=avatar_path, download_big=False)
            
            # If avatar was downloaded successfully, create a URL for it
            if os.path.exists(avatar_path):
                # Generate a unique filename
                _, ext = os.path.splitext(avatar_path)
                avatar_filename = f"{uuid.uuid4()}{ext}"
                avatar_url_path = os.path.join('uploads', avatar_filename)
                avatar_dest_path = os.path.join(current_app.config['UPLOAD_FOLDER'], avatar_filename)
                
                # Ensure upload directory exists
                os.makedirs(os.path.dirname(avatar_dest_path), exist_ok=True)
                
                # Copy avatar to uploads folder
                import shutil
                shutil.copy(avatar_path, avatar_dest_path)
                
                # Remove temporary avatar
                os.remove(avatar_path)
                
                avatar_path = f"/{avatar_url_path}"
            else:
                avatar_path = None
        except:
            avatar_path = None
        
        # Disconnect
        await client.disconnect()
        
        # Format name
        first_name = me.first_name or ''
        last_name = me.last_name or ''
        full_name = first_name
        if last_name:
            full_name += f" {last_name}"
        
        # Return user info
        return {
            'id': me.id,
            'phone': f"+{me.phone}" if me.phone else None,
            'name': full_name,
            'username': me.username or '',
            'avatar': avatar_path,
            'premium': premium
        }
    
    except Exception as e:
        current_app.logger.error(f"Error getting user info from session: {str(e)}")
        try:
            await client.disconnect()
        except:
            pass
        return None


async def _request_code(client, phone_number):
    """Send verification code to a phone number"""
    try:
        await client.connect()
        
        # Check if already authorized
        if await client.is_user_authorized():
            await client.disconnect()
            raise Exception("This phone number is already authorized. Use session import instead.")
        
        # Send code request
        result = await client.send_code_request(phone_number)
        
        return {
            'phone_code_hash': result.phone_code_hash
        }
    
    except Exception as e:
        try:
            await client.disconnect()
        except:
            pass
        raise e


async def _sign_in_with_code(client, phone_number, code, phone_code_hash):
    """Sign in to Telegram with verification code"""
    try:
        await client.connect()
        
        # Check if already authorized
        if await client.is_user_authorized():
            me = await client.get_me()
            await client.disconnect()
            return me
        
        # Sign in with the code
        user = await client.sign_in(phone_number, code, phone_code_hash=phone_code_hash)
        
        # Disconnect
        await client.disconnect()
        
        return user
    
    except Exception as e:
        try:
            await client.disconnect()
        except:
            pass
        raise e


def _load_api_credentials():
    """Load Telegram API credentials"""
    # Try to get from app config
    try:
        api_id = current_app.config.get('TELEGRAM_API_ID')
        api_hash = current_app.config.get('TELEGRAM_API_HASH')
        
        if api_id and api_hash:
            return int(api_id), api_hash
    except (RuntimeError, ValueError):
        pass
    
    # Fallback to config file
    try:
        import configparser
        config_path = os.path.join(os.getcwd(), "data", "telegram_api.ini")
        
        if os.path.exists(config_path):
            config = configparser.ConfigParser()
            config.read(config_path)
            api_id = config.getint('Telegram', 'api_id')
            api_hash = config.get('Telegram', 'api_hash')
            return api_id, api_hash
    except Exception as e:
        current_app.logger.error(f"Error loading API credentials from config: {e}")
    
    # Use default values
    current_app.logger.warning("Using default API credentials")
    return 149467, "65f1b75a0b1d5a6461c1fc67b5514c1b"  # Public test keys app/api/accounts/routes.py - New API endpoints for importing session files and phone verification
