"""
New account routes with improved integration using the new account_integration module.

This module provides enhanced functionality for importing Telegram accounts via
session files, TData and phone numbers.
"""

from flask import request, jsonify, current_app
import os
import datetime
import uuid
import tempfile
from werkzeug.utils import secure_filename

from app.api.accounts import accounts_bp
from app.utils.file_utils import (
    get_accounts, 
    save_accounts, 
    get_account_lists,
    get_accounts_meta,
    save_accounts_meta,
    get_proxies,
    update_account_proxy
)
from app.api.accounts.services import (
    get_filtered_accounts,
    update_existing_account,
    delete_account_by_id,
    bulk_delete_accounts,
    move_accounts
)
from app.api.proxies.services import get_proxy_by_id

# Import the new account integration module
from app.services.account_integration import (
    convert_session_file,
    process_tdata_zip,
    request_phone_verification,
    verify_phone_code,
    check_accounts_sync,
    configure_proxy,
    TELETHON_AVAILABLE,
    OPENTELE_AVAILABLE,
    load_api_credentials
)

@accounts_bp.route('', methods=['GET'])
def get_accounts():
    """Get all accounts, optionally filtered by list_id"""
    list_id = request.args.get('list_id', 'all')
    return jsonify(get_filtered_accounts(list_id))

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
    proxy = get_proxy_by_id(proxy_id)
    if not proxy:
        return jsonify({"error": "Proxy not found"}), 404
    
    # Check if proxy can accept more accounts
    proxy_accounts = proxy.get('accounts', [])
    if len(proxy_accounts) >= 3:
        return jsonify({"error": "Proxy has reached the maximum number of accounts (3)"}), 400
    
    # Configure proxy for Telethon
    proxy_config = configure_proxy(proxy)
    
    # Process the session file
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            # Save the session file to a temporary location
            session_path = os.path.join(temp_dir, session_file.filename)
            session_file.save(session_path)
            
            # Convert and import the session
            result = convert_session_file(session_path)
            
            if "error" in result:
                return jsonify({"error": result["error"]}), 400
            
            account = result["account"]
            
            # Add fields required by the application
            account["list_ids"] = [target_list_id]
            account["list_id"] = target_list_id
            account["proxy_id"] = proxy_id
            
            # Use custom name if provided
            if custom_name:
                account["name"] = custom_name
                
            # Add limits from JSON if available
            if 'limits' in json_data:
                account["limits"] = json_data["limits"]
            else:
                account["limits"] = {
                    "daily_invites": 30,
                    "daily_messages": 50
                }
                
            account["created_at"] = datetime.datetime.now().isoformat()
            account["cooldown_until"] = None
            
            # Check if an account with this phone number already exists
            existing_account = None
            if account.get('phone'):
                accounts = get_accounts()
                existing_account = next((acc for acc in accounts if acc.get('phone') == account['phone']), None)
            
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
                        "session_path": account["session_path"],
                        "telegram_id": account["telegram_id"]
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
                accounts_meta[account["id"]] = {
                    "session_path": account["session_path"],
                    "telegram_id": account["telegram_id"]
                }
                save_accounts_meta(accounts_meta)
                
                # Update proxy association
                from app.utils.file_utils import update_account_proxy
                update_account_proxy(account["id"], proxy_id)
                
                return jsonify({
                    "success": True,
                    "account": account,
                    "updated": False
                })
    
    except Exception as e:
        current_app.logger.error(f"Error in import_session: {str(e)}")
        return jsonify({"error": f"Error importing session: {str(e)}"}), 500

@accounts_bp.route('/import-tdata-zip', methods=['POST'])
def import_tdata_zip_route():
    """Import account from TData ZIP file"""
    if not OPENTELE_AVAILABLE:
        return jsonify({"error": "TData import is not supported in this installation"}), 400
    
    if 'tdata_zip' not in request.files:
        return jsonify({"error": "No TData file provided"}), 400
    
    tdata_zip = request.files['tdata_zip']
    if tdata_zip.filename == '':
        return jsonify({"error": "No TData file selected"}), 400
    
    if not tdata_zip.filename.endswith('.zip'):
        return jsonify({"error": "File must be a .zip file"}), 400
    
    target_list_id = request.form.get('target_list_id', 'main')
    proxy_id = request.form.get('proxy_id')
    
    if not proxy_id:
        return jsonify({"error": "Proxy ID is required"}), 400
    
    proxy = get_proxy_by_id(proxy_id)
    if not proxy:
        return jsonify({"error": "Proxy not found"}), 404
    
    proxy_accounts = proxy.get('accounts', [])
    if len(proxy_accounts) >= 3:
        return jsonify({"error": "Proxy has reached the maximum number of accounts (3)"}), 400
    
    proxy_config = configure_proxy(proxy)
    temp_zip_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_zip:
            temp_zip_path = temp_zip.name
            tdata_zip.save(temp_zip_path)

        # Use the optimized process_tdata_zip function
        result = process_tdata_zip(temp_zip_path, proxy_config=proxy_config)
        
        if "error" in result:
            return jsonify({"error": result["error"]}), 400

        account = result["account"]
        session_path = account.pop("session_path", None)
        telegram_id = account.pop("telegram_id", None)

        account.update({
            "list_ids": [target_list_id],
            "list_id": target_list_id,
            "proxy_id": proxy_id
        })

        accounts = get_accounts()
        if not isinstance(accounts, list):
            current_app.logger.error("Critical: get_accounts() returned non-list type")
            accounts = []

        existing_account = next(
            (acc for acc in accounts 
             if acc.get('phone') == account.get('phone')), 
            None
        )

        accounts_meta = get_accounts_meta()
        
        if existing_account:
            account['id'] = existing_account['id']
            account_index = next(i for i, acc in enumerate(accounts) if acc['id'] == account['id'])
            accounts[account_index] = account
            accounts_meta[account['id']] = {
                "session_path": session_path,
                "telegram_id": telegram_id
            }
        else:
            accounts.append(account)
            accounts_meta[account["id"]] = {
                "session_path": session_path,
                "telegram_id": telegram_id
            }

        save_accounts(accounts)
        save_accounts_meta(accounts_meta)
        update_account_proxy(account['id'], proxy_id)

        return jsonify({
            "success": True,
            "account": account,
            "updated": bool(existing_account)
        })

    except Exception as e:
        current_app.logger.error(f"TData import error: {str(e)}", exc_info=True)
        return jsonify({"error": f"Processing error: {str(e)}"}), 500
    
    finally:
        if temp_zip_path and os.path.exists(temp_zip_path):
            try:
                os.unlink(temp_zip_path)
            except Exception as e:
                current_app.logger.warning(f"Failed to clean up temp file: {str(e)}")

@accounts_bp.route('/request-code', methods=['POST'])
def request_verification_code_route():
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
    proxy = get_proxy_by_id(proxy_id)
    if not proxy:
        return jsonify({"error": "Proxy not found"}), 404
    
    # Check if proxy can accept more accounts
    proxy_accounts = proxy.get('accounts', [])
    if len(proxy_accounts) >= 3:
        return jsonify({"error": "Proxy has reached the maximum number of accounts (3)"}), 400
    
    # Configure proxy for Telethon
    proxy_config = configure_proxy(proxy)
    
    # Request verification code
    result = request_phone_verification(phone, proxy_config)
    
    if "error" in result:
        return jsonify({"error": result["error"]}), 400
        
    return jsonify(result)

@accounts_bp.route('/verify-code', methods=['POST'])
def verify_code_route():
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
    
    # Process verification
    result = verify_phone_code(
        data['phone'],
        data['code'],
        {
            'name': data['name'],
            'username': data.get('username', ''),
            'avatar': data.get('avatar', ''),
            'list_id': data.get('list_id', 'main'),
            'proxy_id': data['proxy_id'],
            'limits': data.get('limits', {
                'daily_invites': 30,
                'daily_messages': 50
            })
        }
    )
    
    if "error" in result:
        return jsonify({"error": result["error"]}), 400
        
    # If successful, prepare response data
    account = result["account"]
    
    # Make a copy of the session path for metadata
    session_path = account.get("session_path")
    telegram_id = account.get("telegram_id")
    
    # Check if an account with this phone number already exists
    accounts = get_accounts()
    existing_account = next((acc for acc in accounts if acc.get('phone') == account['phone']), None)
    
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
                "telegram_id": telegram_id
            }
            save_accounts_meta(accounts_meta)
            
            # Update proxy association
            from app.utils.file_utils import update_account_proxy
            update_account_proxy(account_id, data['proxy_id'])
            
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
        accounts_meta[account["id"]] = {
            "session_path": session_path,
            "telegram_id": telegram_id
        }
        save_accounts_meta(accounts_meta)
        
        # Update proxy association
        from app.utils.file_utils import update_account_proxy
        update_account_proxy(account["id"], data['proxy_id'])
        
        return jsonify({
            "success": True,
            "account": account,
            "updated": False
        })

@accounts_bp.route('/check', methods=['POST'])
def check_accounts_route():
    """Check the status of accounts with Telegram"""
    data = request.json
    account_ids = data.get('account_ids', [])
    
    if not account_ids:
        return jsonify({"error": "No account IDs provided"}), 400
        
    # Gather the accounts to check
    try:
        # Use the fully qualified import path to avoid recursion
        from app.utils.file_utils import get_accounts as fetch_accounts
        all_accounts = fetch_accounts()
        
        # Ensure all_accounts is a list - defensive programming
        if not isinstance(all_accounts, list):
            current_app.logger.error(f"get_accounts() returned non-list type: {type(all_accounts)}")
            if hasattr(all_accounts, 'get_json'):  # It's a Response object
                return all_accounts  # Return the error response as is
            return jsonify({"error": "Failed to retrieve account data"}), 500
            
        accounts_to_check = [acc for acc in all_accounts if acc['id'] in account_ids]
        
        # Get metadata for session paths
        accounts_meta = get_accounts_meta()
        
        # Get proxies for configuration
        all_proxies = get_proxies()
        proxy_configs = {}
        for proxy in all_proxies:
            proxy_configs[proxy['id']] = configure_proxy(proxy)
        
        # Check the accounts
        checked_accounts = check_accounts_sync(accounts_to_check, accounts_meta, proxy_configs)
        
        # Update the accounts in the database
        for updated_account in checked_accounts:
            account_index = next((i for i, acc in enumerate(all_accounts) if acc['id'] == updated_account['id']), None)
            if account_index is not None:
                all_accounts[account_index] = updated_account
        
        save_accounts(all_accounts)
        
        # Return only the checked accounts
        return jsonify(checked_accounts)
    except Exception as e:
        current_app.logger.error(f"Error in check_accounts_route: {str(e)}", exc_info=True)
        return jsonify({"error": f"Error checking accounts: {str(e)}"}), 500

@accounts_bp.route('/<account_id>', methods=['PUT'])
def update_account(account_id):
    """Update an existing account"""
    data = request.json
    
    updated_account = update_existing_account(account_id, data)
    
    if not updated_account:
        return jsonify({"error": "Account not found"}), 404
    
    return jsonify(updated_account)

@accounts_bp.route('/<account_id>', methods=['DELETE'])
def delete_account(account_id):
    """Delete an account by ID"""
    result = delete_account_by_id(account_id)
    
    if not result:
        return jsonify({"error": "Account not found"}), 404
    
    return jsonify({"message": "Account deleted successfully"})

@accounts_bp.route('/bulk-delete', methods=['POST'])
def bulk_delete_route():
    """Delete multiple accounts by their IDs"""
    data = request.json
    account_ids = data.get('account_ids', [])
    
    if not account_ids:
        return jsonify({"error": "No account IDs provided"}), 400
    
    result = bulk_delete_accounts(account_ids)
    
    if result.get('deleted_count', 0) == 0:
        return jsonify({"error": "No accounts found with the provided IDs"}), 404
    
    return jsonify({
        "message": f"Successfully deleted {result['deleted_count']} accounts",
        "deleted_count": result['deleted_count']
    })

@accounts_bp.route('/move', methods=['POST'])
def move_route():
    """Move accounts between lists"""
    data = request.json
    account_ids = data.get('account_ids', [])
    target_list_id = data.get('target_list_id')
    action = data.get('action', 'move')  # 'add', 'remove', or 'move'
    
    if not account_ids:
        return jsonify({"error": "No account IDs provided"}), 400
    
    if not target_list_id:
        return jsonify({"error": "Target list ID is required"}), 400
    
    result = move_accounts(account_ids, target_list_id, action)
    
    return jsonify({
        "message": f"Successfully updated {result['updated_count']} accounts"
    })