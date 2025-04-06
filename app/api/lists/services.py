import uuid
from typing import List, Dict, Any, Optional, Union

from app.utils.file_utils import get_account_lists, save_account_lists, get_accounts, save_accounts


def get_all_lists() -> List[Dict[str, Any]]:
    """
    Get all account lists
    
    Returns:
        List of account list dictionaries
    """
    return get_account_lists()


def create_list_item(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new account list
    
    Args:
        data: List data dictionary
        
    Returns:
        New list dictionary
    """
    lists = get_account_lists()
    
    # Create new list
    new_list = {
        "id": str(uuid.uuid4()),
        "name": data['name'],
        "order": len(lists) + 1
    }
    
    lists.append(new_list)
    save_account_lists(lists)
    
    return new_list


def update_list_item(list_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update an existing account list
    
    Args:
        list_id: ID of the list to update
        data: New list data
        
    Returns:
        Updated list dictionary or None if not found
    """
    lists = get_account_lists()
    
    list_index = next((i for i, lst in enumerate(lists) if lst['id'] == list_id), None)
    
    if list_index is None:
        return None
    
    # Update list fields
    for key, value in data.items():
        if key != 'id':  # Don't allow ID to be changed
            lists[list_index][key] = value
    
    save_account_lists(lists)
    
    return lists[list_index]


def delete_list_item(list_id: str) -> Dict[str, Any]:
    """
    Delete an account list
    
    Args:
        list_id: ID of the list to delete
        
    Returns:
        Dictionary with success message or error
    """
    if list_id == 'main':
        return {"error": "Cannot delete the main list"}
    
    lists = get_account_lists()
    
    initial_count = len(lists)
    lists = [lst for lst in lists if lst['id'] != list_id]
    
    if len(lists) == initial_count:
        return {"error": "List not found"}
    
    save_account_lists(lists)
    
    # Update accounts to remove them from the deleted list
    accounts = get_accounts()
    for acc in accounts:
        if 'list_ids' in acc and list_id in acc['list_ids']:
            acc['list_ids'].remove(list_id)
            # Make sure account is in at least one list
            if not acc['list_ids']:
                acc['list_ids'] = ['main']
                # Also update list_id for backward compatibility
                acc['list_id'] = 'main'
    
    save_accounts(accounts)
    
    return {"success": True}