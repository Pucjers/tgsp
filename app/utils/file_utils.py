import os
import json
from typing import List, Dict, Any, Optional
from flask import current_app


def ensure_data_directory():
    """Ensure that the data directory exists"""
    os.makedirs(current_app.config.get('DATA_DIR', 'data'), exist_ok=True)


def get_accounts() -> List[Dict[str, Any]]:
    """Load accounts from JSON file"""
    accounts_file = current_app.config.get('ACCOUNTS_FILE', 'data/accounts.json')
    ensure_data_directory()
    
    if not os.path.exists(accounts_file):
        with open(accounts_file, 'w') as f:
            json.dump([], f)
        return []
    
    try:
        with open(accounts_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        current_app.logger.error(f"Error loading accounts: {e}")
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
    allowed_extensions = current_app.config.get('ALLOWED_EXTENSIONS', 
                                             {'png', 'jpg', 'jpeg', 'gif'})
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions