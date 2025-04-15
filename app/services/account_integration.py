"""
Telegram Account Integration Module

This module provides comprehensive functionality for importing Telegram accounts via:
1. Session files + JSON metadata
2. TData folders/archives
3. Phone number with verification

It consolidates all account import methods into a single, maintainable module.
"""

import os
import uuid
import json
import zipfile
import asyncio
import tempfile
import shutil
import logging
import datetime
import configparser
from typing import Dict, Any, Optional, Union, Tuple, List

# Telethon for session and phone imports
try:
    from telethon import TelegramClient
    from telethon.tl.functions.users import GetFullUserRequest
    from telethon.errors import (
        PhoneNumberBannedError, 
        FloodWaitError, 
        AuthKeyUnregisteredError,
        UserDeactivatedBanError,
        SessionPasswordNeededError,
        SessionExpiredError,
        PhoneNumberInvalidError,
        PhoneCodeInvalidError,
        PhoneCodeExpiredError
    )
    TELETHON_AVAILABLE = True
except ImportError:
    TELETHON_AVAILABLE = False
    logging.warning("Telethon not available. Session and phone imports will be disabled.")

# OpenTele for TData imports
try:
    from opentele.td import TDesktop
    from opentele.api import UseCurrentSession
    OPENTELE_AVAILABLE = True
except ImportError:
    OPENTELE_AVAILABLE = False
    logging.warning("OpenTele not available. TData import will be disabled.")

# Configure logging
logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Constants
SESSIONS_DIR = os.path.join(os.getcwd(), "saved_sessions")
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")

# Ensure directories exist
os.makedirs(SESSIONS_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Default API credentials
DEFAULT_API_ID = 149467
DEFAULT_API_HASH = "65f1b75a0b1d5a6461c1fc67b5514c1b"

# Active verifications for phone number imports
active_verifications = {}

def load_api_credentials() -> Tuple[int, str]:
    """
    Load Telegram API credentials from config file or use defaults
    
    Returns:
        Tuple containing (api_id, api_hash)
    """
    config_path = os.path.join(os.getcwd(), "data", "telegram_api.ini")
    
    # Try to load from config file
    try:
        if os.path.exists(config_path):
            config = configparser.ConfigParser()
            config.read(config_path)
            api_id = config.getint('Telegram', 'api_id')
            api_hash = config.get('Telegram', 'api_hash')
            return api_id, api_hash
    except Exception as e:
        logger.error(f"Error loading API credentials: {e}")
    
    # Use default values
    logger.warning("Using default API credentials")
    return DEFAULT_API_ID, DEFAULT_API_HASH

def save_api_credentials(api_id: int, api_hash: str) -> bool:
    """
    Save API credentials to config file
    
    Args:
        api_id: Telegram API ID
        api_hash: Telegram API hash
        
    Returns:
        True if saved successfully, False otherwise
    """
    try:
        # Ensure data directory exists
        os.makedirs(os.path.join(os.getcwd(), "data"), exist_ok=True)
        
        # Create config and save
        config = configparser.ConfigParser()
        config.add_section('Telegram')
        config.set('Telegram', 'api_id', str(api_id))
        config.set('Telegram', 'api_hash', api_hash)
        
        config_path = os.path.join(os.getcwd(), "data", "telegram_api.ini")
        with open(config_path, 'w') as configfile:
            config.write(configfile)
            
        return True
    except Exception as e:
        logger.error(f"Error saving API credentials: {e}")
        return False

###################
# SESSION IMPORTS #
###################

async def import_session_file(
    session_path: str, 
    proxy_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Import account from a Telethon/Pyrogram session file
    
    Args:
        session_path: Path to the session file
        proxy_config: Optional proxy configuration
        
    Returns:
        Dict containing account information or error
    """
    if not TELETHON_AVAILABLE:
        return {"error": "Telethon library is not available"}
    
    api_id, api_hash = load_api_credentials()
    
    try:
        # Create client
        session_name = os.path.splitext(os.path.basename(session_path))[0]
        
        # Get the session directory
        session_dir = os.path.dirname(session_path)
        
        # Create new client with the session
        client = TelegramClient(
            os.path.join(session_dir, session_name),
            api_id,
            api_hash,
            proxy=proxy_config
        )
        
        # Connect to Telegram
        await client.connect()
        
        # Check if authorized
        if not await client.is_user_authorized():
            await client.disconnect()
            return {
                "error": "Session file is not authorized"
            }
        
        # Get account information
        me = await client.get_me()
        
        # Check if premium
        premium = False
        try:
            full_user = await client(GetFullUserRequest(me.id))
            premium = getattr(full_user.full_user, "premium", False)
        except Exception as e:
            logger.warning(f"Failed to get premium status: {e}")
        
        # Download avatar
        avatar_path = None
        try:
            avatar_path = os.path.join(SESSIONS_DIR, f"avatar_{me.id}.jpg")
            await client.download_profile_photo(me, file=avatar_path, download_big=False)
            
            # If avatar was downloaded successfully, move it to uploads
            if os.path.exists(avatar_path):
                # Generate a unique filename
                avatar_filename = f"{uuid.uuid4()}.jpg"
                avatar_dest_path = os.path.join(UPLOAD_DIR, avatar_filename)
                
                # Copy avatar to uploads folder
                shutil.copy(avatar_path, avatar_dest_path)
                
                # Remove temporary avatar
                os.remove(avatar_path)
                
                avatar_path = f"/uploads/{avatar_filename}"
        except Exception as e:
            logger.warning(f"Failed to download avatar: {e}")
            avatar_path = None
        
        # Format name
        first_name = me.first_name or ''
        last_name = me.last_name or ''
        full_name = first_name
        if last_name:
            full_name += f" {last_name}"
        
        # Get permanent session path
        permanent_session_path = os.path.join(SESSIONS_DIR, f"{me.id}.session")
        
        # Copy session file to permanent location if needed
        if os.path.normpath(session_path) != os.path.normpath(permanent_session_path):
            shutil.copy(session_path, permanent_session_path)
        
        # Disconnect
        await client.disconnect()
        
        # Create account object
        account = {
            "id": str(uuid.uuid4()),
            "telegram_id": me.id,
            "phone": f"+{me.phone}" if me.phone else None,
            "name": full_name,
            "username": me.username or '',
            "avatar": avatar_path,
            "status": "Не проверен",
            "premium": premium,
            "session_path": permanent_session_path
        }
        
        return {
            "success": True,
            "account": account
        }
    except Exception as e:
        logger.error(f"Error importing session: {e}")
        return {
            "error": f"Failed to import session: {str(e)}"
        }

#################
# TDATA IMPORTS #
#################

def extract_zip_tdata(zip_path: str) -> Dict[str, Any]:
    """
    Extract TData ZIP file to a temporary directory
    
    Args:
        zip_path: Path to the ZIP file
        
    Returns:
        Dict containing extracted path or error
    """
    logger.info(f"Starting ZIP extraction for: {zip_path}")
    temp_dir = tempfile.mkdtemp()
    logger.info(f"Created temporary directory: {temp_dir}")
    
    try:
        # Check if the zip file exists and has content
        if not os.path.exists(zip_path):
            return {"error": f"ZIP file does not exist: {zip_path}"}
        
        file_size = os.path.getsize(zip_path)
        logger.info(f"ZIP file size: {file_size} bytes")
        
        if file_size == 0:
            return {"error": "ZIP file is empty"}
        
        # Extract the ZIP file
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            file_list = zip_ref.namelist()
            logger.info(f"Files in ZIP: {len(file_list)}")
            zip_ref.extractall(temp_dir)
        
        # Find tdata folder
        tdata_dir = os.path.join(temp_dir, "tdata")
        
        # If there's no tdata folder directly, try to find it
        if not os.path.exists(tdata_dir):
            logger.info("tdata folder not found at root level, searching subdirectories...")
            for root, dirs, _ in os.walk(temp_dir):
                for dir_name in dirs:
                    if dir_name == "tdata":
                        tdata_dir = os.path.join(root, dir_name)
                        logger.info(f"Found tdata folder at: {tdata_dir}")
                        break
                if os.path.exists(tdata_dir) and os.path.isdir(tdata_dir):
                    break
        
        # If we still can't find tdata folder, assume the entire zip content is the tdata folder
        if not os.path.exists(tdata_dir) or not os.path.isdir(tdata_dir):
            logger.info("No tdata folder found, assuming entire ZIP content is tdata")
            tdata_dir = temp_dir
        
        # Verify the tdata directory has the right structure
        logger.info(f"Checking tdata directory structure at: {tdata_dir}")
        expected_files = ["map", "key_datas"]
        found_files = [f for f in expected_files if os.path.exists(os.path.join(tdata_dir, f))]
        logger.info(f"Found tdata files: {found_files}")
        
        if not found_files:
            logger.warning("No expected tdata files found")
            # List what was found instead
            dir_contents = os.listdir(tdata_dir)
            logger.info(f"Directory contents: {dir_contents[:10]}")
        
        return {"success": True, "path": tdata_dir, "temp_dir": temp_dir}
    
    except zipfile.BadZipFile as e:
        error_msg = f"Invalid ZIP file: {str(e)}"
        logger.error(error_msg)
        # Clean up in case of error
        shutil.rmtree(temp_dir, ignore_errors=True)
        return {"error": error_msg}
    except Exception as e:
        error_msg = f"Error extracting zip file: {str(e)}"
        logger.error(error_msg)
        # Clean up in case of error
        shutil.rmtree(temp_dir, ignore_errors=True)
        return {"error": error_msg}

async def extract_account_info_from_tdata(tdata_path: str, proxy_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Extract account information from TData folder
    
    Args:
        tdata_path: Path to the TData folder
        proxy_config: Optional proxy configuration
        
    Returns:
        Dict containing account information or error
    """
    if not OPENTELE_AVAILABLE:
        return {"error": "OpenTele library is not available"}
    
    try:
        # Load TDesktop session
        tdesk = TDesktop(tdata_path)
        if not tdesk.isLoaded():
            return {"error": "Failed to load TData session"}
    except Exception as e:
        return {"error": f"Error loading TData: {str(e)}"}
    
    try:
        # Get API credentials
        api_id, api_hash = load_api_credentials()
        
        # Convert to Telethon and connect
        client = await tdesk.ToTelethon(flag=UseCurrentSession, api=f'{api_id} {api_hash}', proxy=proxy_config)
        await client.connect()
        
        if not await client.is_user_authorized():
            await client.disconnect()
            return {"error": "Not authorized with Telegram"}
        
        # Get user info
        me = await client.get_me()
        user_id = me.id
        username = me.username
        phone = me.phone
        first_name = me.first_name
        last_name = me.last_name
        
        # Save the session for later use
        session_path = os.path.join(SESSIONS_DIR, f"{user_id}.session")
        await client.disconnect()
        
        # Reconnect and save session to the specified path
        client = await tdesk.ToTelethon(session=session_path, flag=UseCurrentSession, api=f'{api_id} {api_hash}', proxy=proxy_config)
        await client.connect()
        
        # Check if premium
        premium = False
        try:
            # This is a way to check premium, might need adjustment based on Telethon version
            full_user = await client(GetFullUserRequest(me.id))
            premium = getattr(full_user.full_user, "premium", False)
        except:
            # If we can't get premium status, default to False
            premium = False
            
        # Get avatar
        avatar_path = None
        try:
            avatar_path = os.path.join(SESSIONS_DIR, f"avatar_{user_id}.jpg")
            await client.download_profile_photo(me, file=avatar_path, download_big=False)
            
            # If avatar was downloaded successfully, move it to uploads
            if os.path.exists(avatar_path):
                # Generate a unique filename
                avatar_filename = f"{uuid.uuid4()}.jpg"
                avatar_dest_path = os.path.join(UPLOAD_DIR, avatar_filename)
                
                # Copy avatar to uploads folder
                shutil.copy(avatar_path, avatar_dest_path)
                
                # Remove temporary avatar
                os.remove(avatar_path)
                
                avatar_path = f"/uploads/{avatar_filename}"
        except:
            # If we can't get the avatar, we'll use a default one later
            avatar_path = None
        
        # Disconnect
        await client.disconnect()
        
        # Format name
        full_name = first_name
        if last_name:
            full_name += f" {last_name}"
            
        # Create account object
        account = {
            "id": str(uuid.uuid4()),
            "telegram_id": user_id,
            "phone": f"+{phone}" if phone else "Unknown",
            "name": full_name,
            "username": username,
            "avatar": avatar_path,  # Will be processed by the API later
            "status": "Не проверен",
            "limits": {
                "daily_invites": 30,  # Default values
                "daily_messages": 50
            },
            "created_at": datetime.datetime.now().isoformat(),
            "cooldown_until": None,
            "list_id": "main",
            "premium": premium,
            "session_path": session_path
        }
        
        return {"success": True, "account": account}
    
    except Exception as e:
        # Ensure client is disconnected in case of errors
        try:
            if 'client' in locals() and client.is_connected():
                await client.disconnect()
        except:
            pass
        
        return {"error": f"Error extracting account info: {str(e)}"}

def import_tdata_zip(zip_path: str, proxy_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Import a Telegram account from a TData ZIP file
    
    Args:
        zip_path: Path to the TData ZIP file
        proxy_config: Optional proxy configuration
        
    Returns:
        Dict containing import results
    """
    if not OPENTELE_AVAILABLE:
        return {"error": "OpenTele library is not available"}
    
    logger.info(f"Starting TData ZIP import from: {zip_path}")
    
    # Extract the ZIP file
    extract_result = extract_zip_tdata(zip_path)
    
    if "error" in extract_result:
        logger.error(f"ZIP extraction error: {extract_result['error']}")
        return extract_result
    
    tdata_dir = extract_result["path"]
    temp_dir = extract_result["temp_dir"]
    
    logger.info(f"ZIP extracted, processing TData from: {tdata_dir}")
    
    try:
        # Extract API credentials and save them
        api_id, api_hash = load_api_credentials()
        save_api_credentials(api_id, api_hash)
        
        # Process the TData
        logger.info("Running async extract_account_info_from_tdata")
        # Use an explicit event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(extract_account_info_from_tdata(tdata_dir, proxy_config))
        loop.close()
        
        # Clean up the temporary directory
        logger.info(f"Cleaning up temporary directory: {temp_dir}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        if "error" in result:
            logger.error(f"Account extraction error: {result['error']}")
            return result
        else:
            logger.info(f"Account extraction successful: {result.get('account', {}).get('name')}")
            return result
    
    except Exception as e:
        error_msg = f"Error processing TData: {str(e)}"
        logger.error(error_msg)
        
        # Clean up in case of error
        try:
            logger.info(f"Cleaning up temporary directory after error: {temp_dir}")
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception as cleanup_error:
            logger.error(f"Error during cleanup: {cleanup_error}")
        
        return {"error": error_msg}

#######################
# PHONE NUMBER IMPORT #
#######################

async def request_verification_code(
    phone_number: str, 
    proxy_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Request a verification code for a phone number
    
    Args:
        phone_number: Phone number to verify
        proxy_config: Optional proxy configuration
        
    Returns:
        Dict containing result information
    """
    if not TELETHON_AVAILABLE:
        return {"error": "Telethon library is not available"}
    
    # Format phone number (remove '+' if present)
    if phone_number.startswith('+'):
        phone_number = phone_number[1:]
    
    # Load API credentials
    api_id, api_hash = load_api_credentials()
    
    # Create a temporary session
    session_path = os.path.join(SESSIONS_DIR, f"temp_{phone_number}")
    
    try:
        # Create the client
        client = TelegramClient(
            session_path,
            api_id,
            api_hash,
            proxy=proxy_config
        )
        
        # Connect to Telegram
        await client.connect()
        
        # Check if already authorized
        if await client.is_user_authorized():
            await client.disconnect()
            return {"error": "This phone number is already authorized. Use session import instead."}
        
        # Send code request
        result = await client.send_code_request(phone_number)
        
        # Store the client in active verifications for later use
        active_verifications[phone_number] = {
            'client': client,
            'phone_code_hash': result.phone_code_hash,
            'proxy': proxy_config
        }
        
        return {
            "success": True,
            "message": "Verification code sent",
            "phone_code_hash": result.phone_code_hash
        }
    
    except PhoneNumberInvalidError:
        try:
            await client.disconnect()
        except:
            pass
        return {"error": "Invalid phone number format"}
    except Exception as e:
        try:
            await client.disconnect()
        except:
            pass
        logger.error(f"Error requesting verification code: {e}")
        return {"error": f"Error requesting verification code: {str(e)}"}

async def verify_code(
    phone_number: str, 
    code: str, 
    phone_code_hash: str,
    account_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Verify a phone number with a verification code
    
    Args:
        phone_number: Phone number to verify
        code: Verification code
        phone_code_hash: Hash from the code request
        account_data: Additional account data
        
    Returns:
        Dict containing account information or error
    """
    if not TELETHON_AVAILABLE:
        return {"error": "Telethon library is not available"}
    
    # Format phone number (remove '+' if present)
    if phone_number.startswith('+'):
        phone_number = phone_number[1:]
    
    # Check if we have an active verification for this phone
    if phone_number not in active_verifications:
        return {"error": "No active verification session for this phone number. Please request a code first."}
    
    verification = active_verifications[phone_number]
    client = verification['client']
    saved_phone_code_hash = verification['phone_code_hash']
    proxy_config = verification['proxy']
    
    try:
        # Check connection
        if not client.is_connected():
            await client.connect()
        
        # Sign in with the code
        user = await client.sign_in(phone_number, code, phone_code_hash=saved_phone_code_hash)
        
        # Get the final session file path
        session_path = os.path.join(SESSIONS_DIR, f"{user.id}.session")
        
        # Check premium status
        premium = False
        try:
            from telethon.tl.functions.users import GetFullUserRequest
            full_user = await client(GetFullUserRequest(user.id))
            premium = getattr(full_user.full_user, 'premium', False)
        except:
            pass
            
        # Get avatar
        avatar_path = account_data.get('avatar')
        if not avatar_path:
            try:
                temp_avatar_path = os.path.join(SESSIONS_DIR, f"avatar_{user.id}.jpg")
                await client.download_profile_photo(user, file=temp_avatar_path, download_big=False)
                
                if os.path.exists(temp_avatar_path):
                    # Generate a unique filename
                    avatar_filename = f"{uuid.uuid4()}.jpg"
                    avatar_dest_path = os.path.join(UPLOAD_DIR, avatar_filename)
                    
                    # Copy avatar to uploads folder
                    shutil.copy(temp_avatar_path, avatar_dest_path)
                    
                    # Remove temporary avatar
                    os.remove(temp_avatar_path)
                    
                    avatar_path = f"/uploads/{avatar_filename}"
            except:
                avatar_path = None
        
        # Disconnect client
        await client.disconnect()
        
        # Create account object
        account_id = str(uuid.uuid4())
        account = {
            "id": account_id,
            "telegram_id": user.id,
            "phone": f"+{phone_number}",
            "name": account_data.get('name', f"{user.first_name} {user.last_name if user.last_name else ''}").strip(),
            "username": account_data.get('username', user.username or ''),
            "avatar": avatar_path or f"https://ui-avatars.com/api/?name={account_data.get('name', user.first_name)}&background=random",
            "status": "Не проверен",
            "limits": account_data.get('limits', {
                "daily_invites": 30,
                "daily_messages": 50
            }),
            "created_at": datetime.datetime.now().isoformat(),
            "cooldown_until": None,
            "list_ids": [account_data.get('list_id', 'main')],
            "list_id": account_data.get('list_id', 'main'),
            "premium": premium,
            "session_path": session_path,
            "proxy_id": account_data.get('proxy_id')
        }
        
        # Cleanup
        del active_verifications[phone_number]
        
        return {
            "success": True,
            "account": account
        }
    
    except PhoneCodeInvalidError:
        return {"error": "Invalid verification code"}
    except PhoneCodeExpiredError:
        return {"error": "Verification code has expired. Please request a new code."}
    except SessionPasswordNeededError:
        return {"error": "Two-factor authentication is enabled. Please use TData import for this account."}
    except Exception as e:
        logger.error(f"Error verifying code: {e}")
        return {"error": f"Error verifying code: {str(e)}"}
    finally:
        try:
            await client.disconnect()
        except:
            pass

#####################
# ACCOUNT CHECKING #
#####################

async def check_account(
    session_path: str, 
    proxy_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Check the status of a Telegram account
    
    Args:
        session_path: Path to the session file
        proxy_config: Optional proxy configuration
        
    Returns:
        Dict containing status information
    """
    if not TELETHON_AVAILABLE:
        return {
            "status": "Ошибка проверки",
            "error": "Telethon library is not available"
        }
    
    # Load API credentials
    api_id, api_hash = load_api_credentials()
    
    result = {
        "status": "Не проверен",
        "cooldown_until": None,
        "is_premium": False
    }
    
    try:
        # Check if session file exists
        if not os.path.exists(session_path):
            return {
                "status": "Ошибка проверки",
                "error": "Session file not found"
            }
        
        # Get session name without extension
        session_name = os.path.splitext(os.path.basename(session_path))[0]
        session_dir = os.path.dirname(session_path)
        
        # Connect to Telegram
        client = TelegramClient(
            os.path.join(session_dir, session_name),
            api_id,
            api_hash,
            proxy=proxy_config
        )
        
        await client.connect()
        
        # Check if the client is authorized
        if not await client.is_user_authorized():
            await client.disconnect()
            return {
                "status": "Не авторизован",
                "error": "Client is not authorized"
            }
            
        # Get the account info
        me = await client.get_me()
        
        # Check premium status
        try:
            full_user = await client(GetFullUserRequest(me.id))
            result["is_premium"] = getattr(full_user.full_user, "premium", False)
        except Exception as e:
            logger.warning(f"Error checking premium status: {e}")
        
        # Try to do something that requires authorization
        # For example, get dialogs (recent conversations)
        dialogs = await client.get_dialogs(limit=1)
        
        # If we get here without errors, the account is OK
        result["status"] = "Ок"
        
        # Disconnect the client
        await client.disconnect()
        
        return result
        
    except PhoneNumberBannedError:
        # Permanent ban
        return {
            "status": "Заблокирован",
            "error": "Phone number banned"
        }
    except UserDeactivatedBanError:
        # Account deactivated
        return {
            "status": "Заблокирован",
            "error": "User deactivated"
        }
    except FloodWaitError as e:
        # Temporary block
        cooldown_time = datetime.datetime.now() + datetime.timedelta(seconds=e.seconds)
        return {
            "status": "Временный блок",
            "cooldown_until": cooldown_time.isoformat(),
            "error": f"Flood wait for {e.seconds} seconds"
        }
    except (AuthKeyUnregisteredError, SessionExpiredError):
        # Session expired or invalid
        return {
            "status": "Не авторизован",
            "error": "Session expired or invalid"
        }
    except Exception as e:
        # Any other error
        logger.error(f"Error checking account: {e}")
        return {
            "status": "Ошибка проверки",
            "error": str(e)
        }
    finally:
        # Ensure client is disconnected
        try:
            if 'client' in locals() and client.is_connected():
                await client.disconnect()
        except:
            pass

async def check_multiple_accounts(
    accounts: List[Dict[str, Any]], 
    account_metas: Dict[str, Dict[str, Any]],
    proxy_configs: Dict[str, Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Check multiple accounts in parallel
    
    Args:
        accounts: List of account dictionaries
        account_metas: Dict of account metadata keyed by account ID
        proxy_configs: Dict of proxy configurations keyed by proxy ID
        
    Returns:
        List of updated account dictionaries
    """
    if not TELETHON_AVAILABLE:
        return accounts
    
    results = []
    tasks = []
    
    # Create tasks for checking each account
    for account in accounts:
        account_id = account["id"]
        # Try to get session path from metadata
        session_path = None
        telegram_id = None
        proxy_config = None
        
        # Get metadata and session path
        if account_id in account_metas:
            meta = account_metas[account_id]
            session_path = meta.get("session_path")
            telegram_id = meta.get("telegram_id")
        
        # Get proxy config if proxy_id is set
        if account.get("proxy_id") and account["proxy_id"] in proxy_configs:
            proxy_config = proxy_configs[account["proxy_id"]]
            
        # Skip if no session path is found
        if not session_path:
            # Check if we can find the session by telegram_id
            if telegram_id:
                potential_session = os.path.join(SESSIONS_DIR, f"{telegram_id}.session")
                if os.path.exists(potential_session):
                    session_path = potential_session
                    # Update metadata for future use
                    if account_id in account_metas:
                        account_metas[account_id]["session_path"] = session_path
            
            # If still no session path, try to use phone number as a fallback
            if not session_path and account.get("phone"):
                phone = account["phone"].replace("+", "")
                potential_session = os.path.join(SESSIONS_DIR, f"{phone}.session")
                if os.path.exists(potential_session):
                    session_path = potential_session
                    # Update metadata for future use
                    if account_id in account_metas:
                        account_metas[account_id]["session_path"] = session_path
        
        if session_path:
            # Create a task for checking this account
            task = asyncio.create_task(check_account(session_path, proxy_config))
            tasks.append((account, task))
        else:
            # No session found for this account
            updated_account = account.copy()
            updated_account["status"] = "Ошибка проверки"
            updated_account["error"] = "No session file found"
            results.append(updated_account)
    
    # Execute all tasks concurrently
    for account, task in tasks:
        try:
            check_result = await task
            
            # Update the account with check results
            updated_account = account.copy()
            updated_account["status"] = check_result["status"]
            
            if check_result.get("cooldown_until"):
                updated_account["cooldown_until"] = check_result["cooldown_until"]
            
            if "is_premium" in check_result:
                updated_account["premium"] = check_result["is_premium"]
                
            results.append(updated_account)
            
        except Exception as e:
            logger.error(f"Error checking account {account['id']}: {e}")
            results.append({
                **account,
                "status": "Ошибка проверки",
                "error": str(e)
            })
    
    return results

def check_accounts_sync(
    accounts: List[Dict[str, Any]], 
    account_metas: Dict[str, Dict[str, Any]],
    proxy_configs: Dict[str, Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Synchronous wrapper for the async check_multiple_accounts function
    
    Args:
        accounts: List of account dictionaries
        account_metas: Dict of account metadata keyed by account ID
        proxy_configs: Dict of proxy configurations keyed by proxy ID
        
    Returns:
        List of updated account dictionaries
    """
    if not TELETHON_AVAILABLE:
        return accounts
        
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        results = loop.run_until_complete(check_multiple_accounts(accounts, account_metas, proxy_configs))
    finally:
        loop.close()
    return results

#####################
# UTILITY FUNCTIONS #
#####################

def configure_proxy(proxy: Dict[str, Any]) -> Dict[str, Any]:
    """
    Configure proxy for Telethon based on proxy data
    
    Args:
        proxy: Proxy data dictionary
        
    Returns:
        Dict with proxy configuration
    """
    if not proxy:
        return None
        
    proxy_type = proxy.get('type', 'http')
    host = proxy.get('host', '')
    port = int(proxy.get('port', 0))
    username = proxy.get('username', '')
    password = proxy.get('password', '')
    
    proxy_addr = (host, port)
    proxy_credentials = None
    
    if username and password:
        proxy_credentials = (username, password)
    
    return {
        'proxy_type': proxy_type,
        'addr': proxy_addr,
        'credentials': proxy_credentials
    }
    
def convert_session_file(session_file_path: str, target_dir: str = SESSIONS_DIR) -> Dict[str, Any]:
    """
    Convert a session file to a standard format and save it to the target directory
    
    Args:
        session_file_path: Path to the original session file
        target_dir: Directory to save the converted session
        
    Returns:
        Dict containing the result of the conversion
    """
    if not TELETHON_AVAILABLE:
        return {"error": "Telethon library is not available"}
        
    try:
        # Create an event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Run the import function
        result = loop.run_until_complete(import_session_file(session_file_path))
        
        # Close the loop
        loop.close()
        
        return result
    except Exception as e:
        logger.error(f"Error converting session file: {e}")
        return {
            "error": f"Failed to convert session file: {str(e)}"
        }

def process_tdata_zip(zip_file_path: str, target_dir: str = SESSIONS_DIR, proxy_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Process a TData ZIP file and extract account information
    
    Args:
        zip_file_path: Path to the TData ZIP file
        target_dir: Directory to save the extracted session
        proxy_config: Optional proxy configuration
        
    Returns:
        Dict containing the result of the extraction
    """
    if not OPENTELE_AVAILABLE:
        return {"error": "OpenTele library is not available"}
        
    try:
        # Run the import function
        result = import_tdata_zip(zip_file_path, proxy_config)
        
        return result
    except Exception as e:
        logger.error(f"Error processing TData ZIP: {e}")
        return {
            "error": f"Failed to process TData ZIP: {str(e)}"
        }

def request_phone_verification(phone: str, proxy_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Request verification code for a phone number
    
    Args:
        phone: Phone number to verify
        proxy_config: Optional proxy configuration
        
    Returns:
        Dict containing the result of the request
    """
    if not TELETHON_AVAILABLE:
        return {"error": "Telethon library is not available"}
        
    try:
        # Create an event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Run the request function
        result = loop.run_until_complete(request_verification_code(phone, proxy_config))
        
        # Close the loop
        loop.close()
        
        return result
    except Exception as e:
        logger.error(f"Error requesting phone verification: {e}")
        return {
            "error": f"Failed to request verification code: {str(e)}"
        }

def verify_phone_code(phone: str, code: str, account_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Verify a phone number with a verification code
    
    Args:
        phone: Phone number to verify
        code: Verification code
        account_data: Additional account data
        
    Returns:
        Dict containing the result of verification
    """
    if not TELETHON_AVAILABLE:
        return {"error": "Telethon library is not available"}
        
    if phone not in active_verifications:
        return {"error": "No active verification for this phone number"}
        
    phone_code_hash = active_verifications[phone]['phone_code_hash']
        
    try:
        # Create an event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Run the verification function
        result = loop.run_until_complete(verify_code(phone, code, phone_code_hash, account_data))
        
        # Close the loop
        loop.close()
        
        return result
    except Exception as e:
        logger.error(f"Error verifying phone code: {e}")
        return {
            "error": f"Failed to verify code: {str(e)}"
        }