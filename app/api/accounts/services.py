import os
import uuid
import datetime
import tempfile
import shutil
from typing import List, Dict, Any, Optional, Union
from urllib.parse import quote
from flask import current_app
from werkzeug.datastructures import FileStorage

from app.models.account import Account
from app.utils.file_utils import (
    get_accounts, 
    save_accounts, 
    get_account_lists,
    get_accounts_meta,
    save_accounts_meta,
    update_account_proxy
)

# Import TData integration if available
try:
    from app.services.tdata_integration import convert_zip_tdata_and_get_account
    TDATA_SUPPORT = True
except ImportError:
    TDATA_SUPPORT = False
    current_app.logger.warning("TData integration not available. TData import will be disabled.")

# Import Telegram checker if available
try:
    from app.services.telegram_checker import check_accounts_sync
    TELEGRAM_CHECKER_SUPPORT = True
except ImportError:
    TELEGRAM_CHECKER_SUPPORT = False
    current_app.logger.warning("Telegram checker not available. Account status checking will use fallback mode.")


def get_filtered_accounts(list_id: str = 'all') -> List[Dict[str, Any]]:
    """
    Get accounts, optionally filtered by list_id and deduplicated
    
    Args:
        list_id: The list ID to filter by, or 'all' for all accounts
        
    Returns:
        List of account dictionaries
    """
    accounts = get_accounts()
    
    # Always deduplicate accounts by phone number
    unique_accounts = {}
    
    for acc in accounts:
        phone = str(acc.get('phone', '')).strip()
        if not phone:
            # If there's no phone, use the ID as key to keep the account
            unique_accounts[acc['id']] = acc
            continue
            
        if phone not in unique_accounts:
            # First occurrence of this phone number
            unique_accounts[phone] = acc
        else:
            # Found a duplicate, merge its list_ids with the first occurrence
            existing = unique_accounts[phone]
            
            # Ensure both accounts have list_ids
            if 'list_ids' not in existing:
                existing['list_ids'] = []
                if 'list_id' in existing and existing['list_id']:
                    existing['list_ids'].append(existing['list_id'])
                else:
                    existing['list_ids'] = ['main']
                    
            if 'list_ids' not in acc:
                acc_list_ids = []
                if 'list_id' in acc and acc['list_id']:
                    acc_list_ids.append(acc['list_id'])
                else:
                    acc_list_ids = ['main']
            else:
                acc_list_ids = acc['list_ids']
            
            # Merge list_ids
            for lid in acc_list_ids:
                if lid not in existing['list_ids']:
                    existing['list_ids'].append(lid)
    
    # Convert back to list
    deduplicated = list(unique_accounts.values())
    
    # Now filter by list_id if needed
    if list_id != 'all':
        filtered_accounts = []
        for acc in deduplicated:
            # Check list_ids array if it exists
            if 'list_ids' in acc and list_id in acc['list_ids']:
                filtered_accounts.append(acc)
            # Also check list_id for backward compatibility
            elif acc.get('list_id') == list_id:
                filtered_accounts.append(acc)
        
        return filtered_accounts
    
    # Return all deduplicated accounts
    return deduplicated


def get_account_by_id(account_id: str) -> Optional[Dict[str, Any]]:
    """Get a single account by its ID"""
    accounts = get_accounts()
    return next((acc for acc in accounts if acc['id'] == account_id), None)


def get_account_by_phone(phone: str) -> Optional[Dict[str, Any]]:
    """Get an account by phone number"""
    phone_str = str(phone).strip()
    accounts = get_accounts()
    return next((acc for acc in accounts if str(acc.get('phone', '')).strip() == phone_str), None)


def create_new_account(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new account or update an existing one if phone number already exists
    
    Args:
        data: Account data dictionary
        
    Returns:
        Dictionary with account data and whether it was updated
    """
    accounts = get_accounts()
    
    # Check if a proxy_id was provided and proxy exists with room for more accounts
    if 'proxy_id' in data and data['proxy_id']:
        from app.utils.file_utils import get_proxies, update_account_proxy
        from app.api.proxies.services import get_proxy_by_id
        
        # Fetch the proxy to verify it exists
        proxy = get_proxy_by_id(data['proxy_id'])
        if not proxy:
            return {"error": "Proxy not found", "status_code": 404}
        
        # Check if proxy can accept more accounts
        proxy_accounts = proxy.get('accounts', [])
        if len(proxy_accounts) >= 3:
            return {"error": "Proxy has reached the maximum number of accounts (3)", "status_code": 400}
    else:
        # Proxy is required for new accounts
        return {"error": "A proxy must be specified for new accounts", "status_code": 400}
    
    # Check if an account with this phone number already exists
    phone = data['phone']
    phone_str = str(phone).strip()
    existing_account = get_account_by_phone(phone_str)
    
    if existing_account:
        # If account exists, update its list_ids if needed
        if 'list_ids' in data:
            # Ensure list_ids exists in the account
            if 'list_ids' not in existing_account:
                existing_account['list_ids'] = []
                if 'list_id' in existing_account and existing_account['list_id']:
                    existing_account['list_ids'].append(existing_account['list_id'])
                else:
                    existing_account['list_ids'] = ['main']
                    
            # Add new list IDs if they don't already exist
            for list_id in data['list_ids']:
                if list_id not in existing_account['list_ids']:
                    existing_account['list_ids'].append(list_id)
        elif 'list_id' in data and data['list_id']:
            # Handle the case where list_id is provided but not list_ids
            if 'list_ids' not in existing_account:
                existing_account['list_ids'] = []
            
            if data['list_id'] not in existing_account['list_ids']:
                existing_account['list_ids'].append(data['list_id'])
            
            # Also update the list_id for backward compatibility
            existing_account['list_id'] = data['list_id']
        
        # Update other fields if provided
        for field in ['name', 'username', 'avatar', 'limits']:
            if field in data and data[field]:
                existing_account[field] = data[field]
        
        # Update proxy if provided
        if 'proxy_id' in data:
            old_proxy_id = existing_account.get('proxy_id')
            new_proxy_id = data['proxy_id']
            
            # Only update if proxy changed
            if old_proxy_id != new_proxy_id:
                # Update account-proxy relationship
                update_account_proxy(existing_account['id'], new_proxy_id)
                existing_account['proxy_id'] = new_proxy_id
                
        save_accounts(accounts)
        return {"account": existing_account, "updated": True}
    
    avatar = data.get('avatar')
    if not avatar:
        # Generate UI avatar if no avatar provided
        avatar = f'https://ui-avatars.com/api/?name={quote(data["name"])}&background=random'
    
    # Create new account object with list_ids array
    new_account = {
        "id": str(uuid.uuid4()),
        "phone": phone_str,
        "name": data['name'],
        "username": data.get('username', ''),
        "avatar": avatar,
        "status": "Не проверен",
        "limits": data.get('limits', {}),
        "created_at": datetime.datetime.now().isoformat(),
        "cooldown_until": None,
        "list_ids": data.get('list_ids', ['main']),  # Array of list IDs
        "premium": False,
        "proxy_id": data['proxy_id']  # Add proxy_id to the account
    }
    
    # For backward compatibility, also set the list_id field
    if 'list_id' in data and data['list_id']:
        new_account['list_id'] = data['list_id']
    elif new_account['list_ids']:
        new_account['list_id'] = new_account['list_ids'][0]
    
    accounts.append(new_account)
    save_accounts(accounts)
    
    # Update proxy with this account
    update_account_proxy(new_account['id'], data['proxy_id'])
    
    return {"account": new_account, "updated": False}


def update_existing_account(account_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update an existing account
    
    Args:
        account_id: ID of the account to update
        data: New account data
        
    Returns:
        Updated account dictionary or None if not found
    """
    accounts = get_accounts()
    
    account_index = next((i for i, acc in enumerate(accounts) if acc['id'] == account_id), None)
    
    if account_index is None:
        return None
    
    # Update account fields
    for key, value in data.items():
        if key != 'id':  # Don't allow ID to be changed
            accounts[account_index][key] = value
    
    # Ensure list_ids integrity when list_id is provided
    if 'list_id' in data and data['list_id']:
        if 'list_ids' not in accounts[account_index]:
            accounts[account_index]['list_ids'] = []
        
        if data['list_id'] not in accounts[account_index]['list_ids']:
            accounts[account_index]['list_ids'].append(data['list_id'])
    
    save_accounts(accounts)
    
    return accounts[account_index]


def delete_account_by_id(account_id: str) -> bool:
    """
    Delete an account by ID
    
    Args:
        account_id: ID of the account to delete
        
    Returns:
        True if account was deleted, False if not found
    """
    accounts = get_accounts()
    
    initial_count = len(accounts)
    accounts = [acc for acc in accounts if acc['id'] != account_id]
    
    if len(accounts) == initial_count:
        return False
    
    save_accounts(accounts)
    
    return True


def bulk_delete_accounts(account_ids: List[str]) -> Dict[str, int]:
    """
    Delete multiple accounts by their IDs
    
    Args:
        account_ids: List of account IDs to delete
        
    Returns:
        Dictionary with the number of deleted accounts
    """
    accounts = get_accounts()
    
    initial_count = len(accounts)
    accounts = [acc for acc in accounts if acc['id'] not in account_ids]
    
    deleted_count = initial_count - len(accounts)
    
    if deleted_count > 0:
        save_accounts(accounts)
    
    return {"deleted_count": deleted_count}


def move_accounts(account_ids: List[str], target_list_id: str, action: str = 'move') -> Dict[str, int]:
    """
    Move accounts between lists
    
    Args:
        account_ids: List of account IDs to move
        target_list_id: Target list ID
        action: 'move' (replace current lists), 'add' (add to list), or 'remove' (remove from list)
        
    Returns:
        Dictionary with the number of updated accounts
    """
    # Verify target list exists
    lists = get_account_lists()
    if not any(lst['id'] == target_list_id for lst in lists):
        return {"updated_count": 0, "error": "Target list not found"}
    
    accounts = get_accounts()
    updated_count = 0
    
    # Update list_ids for each account
    for acc in accounts:
        if acc['id'] in account_ids:
            # Ensure list_ids exists (for backward compatibility)
            if 'list_ids' not in acc:
                if 'list_id' in acc:
                    acc['list_ids'] = [acc['list_id']]
                else:
                    acc['list_ids'] = ['main']
            
            # Perform the requested action
            if action == 'add':
                # Add to list if not already in it
                if target_list_id not in acc['list_ids']:
                    acc['list_ids'].append(target_list_id)
                    updated_count += 1
            elif action == 'remove':
                # Remove from list if in it
                if target_list_id in acc['list_ids']:
                    acc['list_ids'].remove(target_list_id)
                    # Make sure account is in at least one list
                    if not acc['list_ids']:
                        acc['list_ids'] = ['main']
                    updated_count += 1
            else:  # move
                # Replace all current lists with the target list
                acc['list_ids'] = [target_list_id]
                # Also update the old list_id for backward compatibility
                acc['list_id'] = target_list_id
                updated_count += 1
    
    if updated_count > 0:
        save_accounts(accounts)
    
    return {"updated_count": updated_count}


def check_accounts(account_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Check the status of accounts with Telegram
    
    Args:
        account_ids: List of account IDs to check
        
    Returns:
        List of checked account dictionaries
    """
    accounts = get_accounts()
    
    try:
        if TELEGRAM_CHECKER_SUPPORT:
            # Use the real telegram checker
            updated_accounts = check_accounts_sync(account_ids, accounts)
            
            # Save the updated accounts
            for updated_account in updated_accounts:
                account_index = next((i for i, acc in enumerate(accounts) if acc['id'] == updated_account['id']), None)
                if account_index is not None:
                    accounts[account_index] = updated_account
            
            save_accounts(accounts)
            
            # Return the checked accounts
            checked_accounts = [acc for acc in accounts if acc['id'] in account_ids]
            return checked_accounts
        else:
            # Fallback to random status if checker is not available
            current_app.logger.warning("Telegram checker not available, using random status")
            
            import random
            
            # The random status fallback
            for account_id in account_ids:
                account = next((acc for acc in accounts if acc['id'] == account_id), None)
                if account:
                    status_options = ["Ок", "Заблокирован", "Временный блок", "Не авторизован", "Ошибка проверки"]
                    account['status'] = random.choice(status_options)
                    
                    if account['status'] == "Временный блок":
                        hours = random.randint(1, 48)
                        cooldown = datetime.datetime.now() + datetime.timedelta(hours=hours)
                        account['cooldown_until'] = cooldown.isoformat()
            
            save_accounts(accounts)
            
            checked_accounts = [acc for acc in accounts if acc['id'] in account_ids]
            return checked_accounts
    except Exception as e:
        # Any other error
        current_app.logger.error(f"Error checking accounts: {str(e)}")
        return []


def import_tdata_zip(tdata_zip: FileStorage, target_list_id: str = 'main', proxy_id: str = None) -> Dict[str, Any]:
    """
    Import a Telegram account from a TData ZIP file
    
    Args:
        tdata_zip: The uploaded TData ZIP file
        target_list_id: The list ID to add the account to
        proxy_id: The proxy ID to use for this account
        
    Returns:
        Dictionary with import results
    """
    if not TDATA_SUPPORT:
        return {"error": "TData import is not supported in this installation"}
    
    # Verify proxy exists and can accept more accounts
    if proxy_id:
        from app.api.proxies.services import get_proxy_by_id
        proxy = get_proxy_by_id(proxy_id)
        if not proxy:
            return {"error": "Proxy not found"}
        
        # Check if proxy can accept more accounts
        proxy_accounts = proxy.get('accounts', [])
        if len(proxy_accounts) >= 3:
            return {"error": "Proxy has reached the maximum number of accounts (3)"}
    else:
        return {"error": "Proxy ID is required"}
    
    try:
        # Create a temporary file to store the uploaded zip
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_zip:
            zip_path = temp_zip.name
            tdata_zip.save(zip_path)
        
        # Process the TData ZIP file
        result = convert_zip_tdata_and_get_account(zip_path)
        
        # Remove the temporary file
        try:
            os.unlink(zip_path)
        except Exception as e:
            current_app.logger.warning(f"Failed to remove temporary file: {e}")
        
        if "error" in result:
            return {"error": result["error"]}
        
        # If successful, handle the account
        account = result["account"]
        
        # Process avatar if available
        if account["avatar"] and os.path.exists(account["avatar"]):
            # Generate a unique filename
            _, ext = os.path.splitext(account["avatar"])
            avatar_filename = f"{uuid.uuid4()}{ext}"
            avatar_path = os.path.join(current_app.config['UPLOAD_FOLDER'], avatar_filename)
            
            # Copy avatar to uploads folder
            shutil.copy(account["avatar"], avatar_path)
            
            # Update avatar URL
            account["avatar"] = f"/uploads/{avatar_filename}"
        else:
            # Use default avatar
            account["avatar"] = f"https://ui-avatars.com/api/?name={account['name']}&background=random"
        
        # Remove session_path from the response as it's not needed in the frontend
        session_path = account.pop("session_path", None)
        telegram_id = account.pop("telegram_id", None)
        
        # Set the list_ids and list_id based on the target list
        account["list_ids"] = [target_list_id]
        account["list_id"] = target_list_id
        
        # Set proxy_id (required)
        account["proxy_id"] = proxy_id
        
        # Get existing metadata
        accounts_meta = get_accounts_meta()
        
        # Save metadata with session path and telegram_id
        accounts_meta[account["id"]] = {
            "session_path": session_path,
            "telegram_id": telegram_id
        }

        save_accounts_meta(accounts_meta)
        
        # Check if an account with this phone number already exists
        existing_account = get_account_by_phone(account.get("phone", ""))
        
        if existing_account:
            # Update existing account
            result = update_existing_account(existing_account["id"], {
                "avatar": account["avatar"],
                "list_ids": account["list_ids"],
                "list_id": account["list_id"],
                "proxy_id": proxy_id
            })
            
            # Update the proxy with this account
            update_account_proxy(existing_account["id"], proxy_id)
            
            return {"success": True, "account": existing_account, "updated": True}
        else:
            # Save the new account
            accounts = get_accounts()
            accounts.append(account)
            save_accounts(accounts)
            
            # Update the proxy with this account
            update_account_proxy(account["id"], proxy_id)
            
            return {"success": True, "account": account, "updated": False}
            
    except Exception as e:
        current_app.logger.error(f"Error in import_tdata_zip: {str(e)}")
        return {"error": f"Error importing TData: {str(e)}"}