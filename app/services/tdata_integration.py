from opentele.td import TDesktop
from opentele.api import UseCurrentSession
from telethon.tl.functions.users import GetFullUserRequest
import asyncio
import os
import json
import uuid
import zipfile
import tempfile
import configparser
import struct
import shutil
from datetime import datetime

# Directory for storing converted sessions
SESSIONS_DIR = os.path.join(os.getcwd(), "saved_sessions")
# Ensure directory exists
os.makedirs(SESSIONS_DIR, exist_ok=True)

async def extract_account_info(tdata_path):
    """
    Extract account information from TData folder and return account data
    """
    # Load TDesktop session
    try:
        tdesk = TDesktop(tdata_path)
        if not tdesk.isLoaded():
            return {"error": "Failed to load TData session"}
    except Exception as e:
        return {"error": f"Error loading TData: {str(e)}"}
    
    try:
        # Convert to Telethon and connect
        client = await tdesk.ToTelethon(flag=UseCurrentSession)
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
        client = await tdesk.ToTelethon(session=session_path, flag=UseCurrentSession)
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
        except:
            # If we can't get the avatar, we'll use a default one later
            pass
        
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
            "created_at": datetime.now().isoformat(),
            "cooldown_until": None,
            "list_id": "main",
            "premium": premium,
            "session_path": session_path
        }
        
        return {"success": True, "account": account}
    
    except Exception as e:
        # Ensure client is disconnected in case of errors
        try:
            if client and client.is_connected():
                await client.disconnect()
        except:
            pass
        
        return {"error": f"Error extracting account info: {str(e)}"}

def extract_zip_tdata(zip_path):
    """
    Extract TData zip file to a temporary directory
    """
    print(f"Starting ZIP extraction for: {zip_path}")
    temp_dir = tempfile.mkdtemp()
    print(f"Created temporary directory: {temp_dir}")
    
    try:
        # Check if the zip file exists and has content
        if not os.path.exists(zip_path):
            return {"error": f"ZIP file does not exist: {zip_path}"}
        
        file_size = os.path.getsize(zip_path)
        print(f"ZIP file size: {file_size} bytes")
        
        if file_size == 0:
            return {"error": "ZIP file is empty"}
        
        # List the contents of the zip file
        print("Listing ZIP contents:")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            file_list = zip_ref.namelist()
            print(f"Files in ZIP: {len(file_list)}")
            for i, file in enumerate(file_list[:10]):  # Print first 10 files
                print(f"  {i+1}. {file}")
            if len(file_list) > 10:
                print(f"  ... and {len(file_list) - 10} more files")
            
            print(f"Extracting ZIP to: {temp_dir}")
            zip_ref.extractall(temp_dir)
        
        # Check if there's a tdata folder inside the zip
        tdata_dir = os.path.join(temp_dir, "tdata")
        print(f"Looking for tdata folder at: {tdata_dir}")
        
        # If there's no tdata folder directly, try to find it
        if not os.path.exists(tdata_dir):
            print("tdata folder not found at root level, searching subdirectories...")
            # Try to find a directory containing the tdata folder
            for root, dirs, _ in os.walk(temp_dir):
                for dir_name in dirs:
                    if dir_name == "tdata":
                        tdata_dir = os.path.join(root, dir_name)
                        print(f"Found tdata folder at: {tdata_dir}")
                        break
                if os.path.exists(tdata_dir) and os.path.isdir(tdata_dir):
                    break
        
        # If we still can't find tdata folder, assume the entire zip content is the tdata folder
        if not os.path.exists(tdata_dir) or not os.path.isdir(tdata_dir):
            print("No tdata folder found, assuming entire ZIP content is tdata")
            tdata_dir = temp_dir
        
        # Verify the tdata directory has the right structure
        print(f"Checking tdata directory structure at: {tdata_dir}")
        expected_files = ["map", "keys_data"]
        found_files = [f for f in expected_files if os.path.exists(os.path.join(tdata_dir, f))]
        print(f"Found tdata files: {found_files}")
        
        if not found_files:
            print("Warning: No expected tdata files found")
            # List what was found instead
            dir_contents = os.listdir(tdata_dir)
            print(f"Directory contents: {dir_contents[:10]}")
            if len(dir_contents) > 10:
                print(f"... and {len(dir_contents) - 10} more items")
        
        return {"success": True, "path": tdata_dir, "temp_dir": temp_dir}
    
    except zipfile.BadZipFile as e:
        error_msg = f"Invalid ZIP file: {str(e)}"
        print(error_msg)
        # Clean up in case of error
        shutil.rmtree(temp_dir, ignore_errors=True)
        return {"error": error_msg}
    except Exception as e:
        error_msg = f"Error extracting zip file: {str(e)}"
        print(error_msg)
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        # Clean up in case of error
        shutil.rmtree(temp_dir, ignore_errors=True)
        return {"error": error_msg}

def extract_api_credentials_from_tdata(tdata_path):
    """
    Try to extract API credentials from a TData folder
    """
    try:
        # Check for various known paths in TData where credentials might be stored
        api_paths = [
            os.path.join(tdata_path, 'key_datas'),
            os.path.join(tdata_path, 'D877F783D5D3EF8Cs'),
        ]
        
        # This is a simplification - in a real implementation, 
        # you would need to decrypt and parse the TData format
        # which is complex and outside the scope of this example
        
        # For now, we'll use default credentials and save them
        api_id = 149467  # This is a public testing API ID
        api_hash = "65f1b75a0b1d5a6461c1fc67b5514c1b"  # Public testing API hash
        
        # Save these credentials for future use
        config = configparser.ConfigParser()
        config.add_section('Telegram')
        config.set('Telegram', 'api_id', str(api_id))
        config.set('Telegram', 'api_hash', api_hash)
        
        # Ensure the data directory exists
        os.makedirs(os.path.join(os.getcwd(), "data"), exist_ok=True)
        
        # Save to config file
        config_path = os.path.join(os.getcwd(), "data", "telegram_api.ini")
        with open(config_path, 'w') as configfile:
            config.write(configfile)
        
        return {
            "api_id": api_id,
            "api_hash": api_hash
        }
    except Exception as e:
        print(f"Error extracting API credentials: {e}")
        return None

# Modify convert_zip_tdata_and_get_account to extract API credentials
def convert_zip_tdata_and_get_account(zip_path):
    """
    Convert TData from a zip file to Telethon session and return account info
    """
    print(f"Starting ZIP TData conversion for: {zip_path}")
    
    # Extract the zip file
    extract_result = extract_zip_tdata(zip_path)
    
    if "error" in extract_result:
        print(f"ZIP extraction error: {extract_result['error']}")
        return extract_result
    
    tdata_dir = extract_result["path"]
    temp_dir = extract_result["temp_dir"]
    
    print(f"ZIP extracted, processing TData from: {tdata_dir}")
    
    try:
        # Extract API credentials
        print("Extracting API credentials from TData")
        extract_api_credentials_from_tdata(tdata_dir)
        
        # Process the TData
        print("Running async extract_account_info")
        result = asyncio.run(extract_account_info(tdata_dir))
        
        # Clean up the temporary directory
        print(f"Cleaning up temporary directory: {temp_dir}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        if "error" in result:
            print(f"Account extraction error: {result['error']}")
        else:
            print(f"Account extraction successful: {result.get('account', {}).get('name')}")
        
        return result
    
    except Exception as e:
        error_msg = f"Error processing TData: {str(e)}"
        print(error_msg)
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        
        # Clean up in case of error
        try:
            print(f"Cleaning up temporary directory after error: {temp_dir}")
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception as cleanup_error:
            print(f"Error during cleanup: {cleanup_error}")
        
        return {"error": error_msg}

def convert_tdata_and_get_account(tdata_path):
    """
    Convert TData to Telethon session and return account info
    """
    return asyncio.run(extract_account_info(tdata_path))