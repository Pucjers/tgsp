import os
import json
from typing import List, Dict, Any, Optional
from flask import current_app
import logging

logger = logging.getLogger(__name__)


def ensure_data_directory():
    """Ensure that the data directory exists"""
    os.makedirs(current_app.config.get('DATA_DIR', 'data'), exist_ok=True)



def get_accounts() -> list:
    """Get all accounts from storage. Always returns a list."""
    try:
        # Load accounts from file/database
        data_dir = 'data'
        
        # Try to get the directory from app config if available
        try:
            data_dir = current_app.config.get('DATA_DIR', 'data')
        except RuntimeError:
            # Not in application context
            pass
            
        accounts_file = os.path.join(data_dir, 'accounts.json')
        
        # Ensure the directory exists
        os.makedirs(data_dir, exist_ok=True)
        
        # Create empty file if it doesn't exist
        if not os.path.exists(accounts_file):
            with open(accounts_file, 'w', encoding='utf-8') as f:
                json.dump([], f)
            return []
            
        with open(accounts_file, 'r', encoding='utf-8') as f:
            accounts = json.load(f)
            
        # Ensure we always return a list, even if the file contains something else
        if not isinstance(accounts, list):
            logger.error(f"accounts.json doesn't contain a list. Resetting to empty list.")
            with open(accounts_file, 'w', encoding='utf-8') as f:
                json.dump([], f)
            return []
            
        return accounts
    except FileNotFoundError:
        logger.warning("Accounts file not found. Returning empty list.")
        return []
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in accounts file: {str(e)}")
        return []
    except Exception as e:
        logger.error(f"Error loading accounts: {str(e)}")
        return [] 


def save_accounts(accounts: List[Dict[str, Any]]) -> bool:
    """Save accounts to JSON file"""
    accounts_file = current_app.config.get('ACCOUNTS_FILE', 'data/accounts.json')
    ensure_data_directory()
    
    try:
        with open(accounts_file, 'w') as f:
            json.dump(accounts, f, indent=2)
        return True
    except Exception as e:
        current_app.logger.error(f"Error saving accounts: {e}")
        return False


def get_account_lists() -> List[Dict[str, Any]]:
    """Load account lists from JSON file"""
    lists_file = current_app.config.get('LISTS_FILE', 'data/account_lists.json')
    ensure_data_directory()
    
    if not os.path.exists(lists_file):
        default_lists = [{"id": "main", "name": "Main List", "order": 1}]
        with open(lists_file, 'w') as f:
            json.dump(default_lists, f)
        return default_lists
    
    try:
        with open(lists_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        current_app.logger.error(f"Error loading account lists: {e}")
        return [{"id": "main", "name": "Main List", "order": 1}]


def save_account_lists(lists: List[Dict[str, Any]]) -> bool:
    """Save account lists to JSON file"""
    lists_file = current_app.config.get('LISTS_FILE', 'data/account_lists.json')
    ensure_data_directory()
    
    try:
        with open(lists_file, 'w') as f:
            json.dump(lists, f, indent=2)
        return True
    except Exception as e:
        current_app.logger.error(f"Error saving account lists: {e}")
        return False


def get_accounts_meta() -> Dict[str, Any]:
    """Load account metadata from JSON file"""
    meta_file = current_app.config.get('ACCOUNTS_META_FILE', 'data/accounts_meta.json')
    ensure_data_directory()
    
    if not os.path.exists(meta_file):
        with open(meta_file, 'w') as f:
            json.dump({}, f)
        return {}
    
    try:
        with open(meta_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        current_app.logger.error(f"Error loading account metadata: {e}")
        return {}


def save_accounts_meta(meta_data: Dict[str, Any]) -> bool:
    """Save account metadata to JSON file"""
    meta_file = current_app.config.get('ACCOUNTS_META_FILE', 'data/accounts_meta.json')
    ensure_data_directory()
    
    try:
        with open(meta_file, 'w') as f:
            json.dump(meta_data, f, indent=2)
        return True
    except Exception as e:
        current_app.logger.error(f"Error saving account metadata: {e}")
        return False


def allowed_file(filename: str) -> bool:
    """Check if a filename has an allowed extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in current_app.config.get('ALLOWED_EXTENSIONS', {'png', 'jpg', 'jpeg', 'gif'})


# New functions for proxy management
def get_proxies_file() -> str:
    """Get the path to the proxies data file"""
    try:
        return os.path.join(current_app.config.get('DATA_DIR', 'data'), 'proxies.json')
    except RuntimeError:
        # Fallback when outside application context
        return os.path.join('data', 'proxies.json')


def get_proxies() -> List[Dict[str, Any]]:
    """Load proxies from JSON file"""
    proxies_file = get_proxies_file()
    ensure_data_directory()
    
    if not os.path.exists(proxies_file):
        with open(proxies_file, 'w') as f:
            json.dump([], f)
        return []
    
    try:
        with open(proxies_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        current_app.logger.error(f"Error loading proxies: {e}")
        return []


def save_proxies(proxies: List[Dict[str, Any]]) -> bool:
    """Save proxies to JSON file"""
    proxies_file = get_proxies_file()
    ensure_data_directory()
    
    try:
        with open(proxies_file, 'w') as f:
            json.dump(proxies, f, indent=2)
        return True
    except Exception as e:
        current_app.logger.error(f"Error saving proxies: {e}")
        return False


def get_proxy_by_id(proxy_id: str) -> Optional[Dict[str, Any]]:
    """Get a single proxy by its ID"""
    proxies = get_proxies()
    return next((proxy for proxy in proxies if proxy['id'] == proxy_id), None)


def update_account_proxy(account_id: str, proxy_id: Optional[str]) -> bool:
    """Update the proxy association for an account"""
    accounts = get_accounts()
    proxies = get_proxies()
    
    account_index = next((i for i, acc in enumerate(accounts) if acc['id'] == account_id), None)
    if account_index is None:
        return False
    
    # If removing proxy association
    if proxy_id is None:
        # Check if account had a previous proxy
        old_proxy_id = accounts[account_index].get('proxy_id')
        if old_proxy_id:
            # Remove account from old proxy's accounts list
            old_proxy_index = next((i for i, p in enumerate(proxies) if p['id'] == old_proxy_id), None)
            if old_proxy_index is not None:
                if 'accounts' in proxies[old_proxy_index] and account_id in proxies[old_proxy_index]['accounts']:
                    proxies[old_proxy_index]['accounts'].remove(account_id)
        
        # Remove proxy_id from account
        accounts[account_index]['proxy_id'] = None
        save_accounts(accounts)
        save_proxies(proxies)
        return True
    
    # Check if the proxy exists and can accept more accounts
    proxy_index = next((i for i, p in enumerate(proxies) if p['id'] == proxy_id), None)
    if proxy_index is None:
        return False
    
    # Check if this proxy already has 3 accounts and this account is not already assigned to it
    if ('accounts' in proxies[proxy_index] and 
        len(proxies[proxy_index]['accounts']) >= 3 and 
        account_id not in proxies[proxy_index]['accounts']):
        return False
    
    # Check if account had a previous proxy
    old_proxy_id = accounts[account_index].get('proxy_id')
    if old_proxy_id and old_proxy_id != proxy_id:
        # Remove account from old proxy's accounts list
        old_proxy_index = next((i for i, p in enumerate(proxies) if p['id'] == old_proxy_id), None)
        if old_proxy_index is not None:
            if 'accounts' in proxies[old_proxy_index] and account_id in proxies[old_proxy_index]['accounts']:
                proxies[old_proxy_index]['accounts'].remove(account_id)
    
    # Update account with new proxy_id
    accounts[account_index]['proxy_id'] = proxy_id
    
    # Add account to proxy's accounts list
    if 'accounts' not in proxies[proxy_index]:
        proxies[proxy_index]['accounts'] = []
    
    if account_id not in proxies[proxy_index]['accounts']:
        proxies[proxy_index]['accounts'].append(account_id)
    
    # Save changes
    save_accounts(accounts)
    save_proxies(proxies)
    return True