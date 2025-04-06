from telethon import TelegramClient
from telethon.errors import (
    PhoneNumberBannedError, 
    FloodWaitError, 
    AuthKeyUnregisteredError,
    UserDeactivatedBanError,
    SessionPasswordNeededError,
    SessionExpiredError
)
import asyncio
import json
import os
import datetime
from typing import List, Dict, Any
import configparser

# Directory for saved sessions
SESSIONS_DIR = os.path.join(os.getcwd(), "saved_sessions")

# Default API credentials (will only be used if no credentials found in TData)
DEFAULT_API_ID = 1234567  # This is just a fallback
DEFAULT_API_HASH = "0123456789abcdef0123456789abcdef"  # This is just a fallback

def load_tdata_credentials():
    """
    Try to load API credentials from saved TData or config file
    """
    config_path = os.path.join(os.getcwd(), "data", "telegram_api.ini")
    
    # Check if we have saved credentials
    if os.path.exists(config_path):
        try:
            config = configparser.ConfigParser()
            config.read(config_path)
            api_id = config.getint('Telegram', 'api_id')
            api_hash = config.get('Telegram', 'api_hash')
            return api_id, api_hash
        except Exception as e:
            print(f"Error loading API credentials from config: {e}")
    
    # If no saved credentials, try to extract from any session
    try:
        if os.path.exists(SESSIONS_DIR):
            # Try to find a .session file
            session_files = [f for f in os.listdir(SESSIONS_DIR) if f.endswith('.session')]
            if session_files:
                session_path = os.path.join(SESSIONS_DIR, session_files[0])
                # Extract credentials directly from the session file
                # This is a complex operation that requires understanding the session file format
                # For simplicity, we'll use the default credentials for now
                
                # In a real implementation, you might use libraries or techniques to 
                # extract API ID and hash from the session
                pass
    except Exception as e:
        print(f"Error extracting API credentials from session: {e}")
    
    return DEFAULT_API_ID, DEFAULT_API_HASH

async def check_account(session_path: str, telegram_id: int = None) -> Dict[str, Any]:
    """
    Check the status of a Telegram account using the saved session.
    
    Returns:
        dict: Account status with keys:
            - status (str): "Ок", "Заблокирован", "Временный блок", etc.
            - cooldown_until (str or None): ISO date string if temporarily blocked
            - is_premium (bool): Whether the account has premium status
    """
    # Load API credentials
    API_ID, API_HASH = load_tdata_credentials()
    
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
        
        # Connect to Telegram
        client = TelegramClient(session_path, API_ID, API_HASH)
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
            from telethon.tl.functions.users import GetFullUserRequest
            full_user = await client(GetFullUserRequest(me.id))
            result["is_premium"] = getattr(full_user.full_user, "premium", False)
        except Exception as e:
            print(f"Error checking premium status: {e}")
            # Continue with the check even if premium check fails
        
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

async def check_multiple_accounts(account_ids: List[str], accounts_data: List[Dict]) -> List[Dict]:
    """
    Check multiple accounts in parallel
    """
    # Find the accounts with the given IDs
    accounts_to_check = []
    for account in accounts_data:
        if account["id"] in account_ids:
            accounts_to_check.append(account)
    
    results = []
    tasks = []
    
    # Load account metadata from a separate file if it exists
    accounts_meta = {}
    meta_file = os.path.join(os.getcwd(), "data", "accounts_meta.json")
    if os.path.exists(meta_file):
        try:
            with open(meta_file, 'r') as f:
                accounts_meta = json.load(f)
        except:
            print("Error loading accounts metadata")
    
    # Create tasks for checking each account
    for account in accounts_to_check:
        account_id = account["id"]
        # Try to get session path from metadata
        session_path = None
        telegram_id = None
        
        if account_id in accounts_meta:
            session_path = accounts_meta[account_id].get("session_path")
            telegram_id = accounts_meta[account_id].get("telegram_id")
        
        # If not found in metadata, try to use default naming convention
        if not session_path:
            # Fallback: Try to find a session for this account by pattern matching
            # This is less reliable but might work if metadata is not available
            for filename in os.listdir(SESSIONS_DIR):
                if filename.endswith(".session") and account_id in filename:
                    session_path = os.path.join(SESSIONS_DIR, filename)
                    break
        
        if session_path:
            # Create a task for checking this account
            task = asyncio.create_task(check_account(session_path, telegram_id))
            tasks.append((account, task))
        else:
            # No session found for this account
            results.append({
                **account,
                "status": "Ошибка проверки",
                "error": "No session file found"
            })
    
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
            print(f"Error checking account {account['id']}: {e}")
            results.append({
                **account,
                "status": "Ошибка проверки",
                "error": str(e)
            })
    
    return results

def check_accounts_sync(account_ids: List[str], accounts_data: List[Dict]) -> List[Dict]:
    """
    Synchronous wrapper for the async check_multiple_accounts function
    """
    return asyncio.run(check_multiple_accounts(account_ids, accounts_data))