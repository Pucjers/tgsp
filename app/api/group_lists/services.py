# app/api/group_lists/services.py

import uuid
from typing import List, Dict, Any, Optional, Union
import os
import json
from flask import current_app

from app.utils.file_utils import ensure_data_directory
from app.api.groups.services import get_all_groups, save_groups


def get_group_lists_file() -> str:
    """Get the path to the group lists data file"""
    try:
        return os.path.join(current_app.config.get('DATA_DIR', 'data'), 'group_lists.json')
    except RuntimeError:
        # Fallback when outside application context
        return os.path.join('data', 'group_lists.json')


def get_all_group_lists() -> List[Dict[str, Any]]:
    """
    Get all group lists
    
    Returns:
        List of group list dictionaries
    """
    lists_file = get_group_lists_file()
    ensure_data_directory()
    
    if not os.path.exists(lists_file):
        default_lists = [{"id": "main", "name": "Main Group List", "order": 1}]
        with open(lists_file, 'w') as f:
            json.dump(default_lists, f)
        return default_lists
    
    try:
        with open(lists_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        current_app.logger.error(f"Error loading group lists: {e}")
        return [{"id": "main", "name": "Main Group List", "order": 1}]


def save_group_lists(lists: List[Dict[str, Any]]) -> bool:
    """
    Save group lists to JSON file
    
    Args:
        lists: List of group list dictionaries
        
    Returns:
        True if saved successfully, False otherwise
    """
    lists_file = get_group_lists_file()
    ensure_data_directory()
    
    try:
        with open(lists_file, 'w') as f:
            json.dump(lists, f, indent=2)
        return True
    except Exception as e:
        current_app.logger.error(f"Error saving group lists: {e}")
        return False


def create_group_list_item(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new group list
    
    Args:
        data: List data dictionary
        
    Returns:
        New list dictionary
    """
    lists = get_all_group_lists()
    
    # Create new list
    new_list = {
        "id": str(uuid.uuid4()),
        "name": data['name'],
        "order": len(lists) + 1
    }
    
    lists.append(new_list)
    save_group_lists(lists)
    
    return new_list


def update_group_list_item(list_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update an existing group list
    
    Args:
        list_id: ID of the list to update
        data: New list data
        
    Returns:
        Updated list dictionary or None if not found
    """
    lists = get_all_group_lists()
    
    list_index = next((i for i, lst in enumerate(lists) if lst['id'] == list_id), None)
    
    if list_index is None:
        return None
    
    # Update list fields
    for key, value in data.items():
        if key != 'id':  # Don't allow ID to be changed
            lists[list_index][key] = value
    
    save_group_lists(lists)
    
    return lists[list_index]


def delete_group_list_item(list_id: str) -> Dict[str, Any]:
    """
    Delete a group list
    
    Args:
        list_id: ID of the list to delete
        
    Returns:
        Dictionary with success message or error
    """
    if list_id == 'main':
        return {"error": "Cannot delete the main list"}
    
    lists = get_all_group_lists()
    
    initial_count = len(lists)
    lists = [lst for lst in lists if lst['id'] != list_id]
    
    if len(lists) == initial_count:
        return {"error": "List not found"}
    
    save_group_lists(lists)
    
    # Update groups to move them to the main list if they were in the deleted list
    groups = get_all_groups()
    for group in groups:
        if group.get('list_id') == list_id:
            group['list_id'] = 'main'
    
    save_groups(groups)
    
    return {"success": True}