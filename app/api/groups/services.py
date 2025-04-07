import os
import json
import uuid
import logging
from typing import List, Dict, Any, Optional, Union
from flask import current_app

from app.utils.file_utils import ensure_data_directory

# Setup a basic logger for use outside application context
logger = logging.getLogger(__name__)

# Import the Telegram group parser
# We wrap this in a try-except to handle the case where it's not yet available
try:
    from app.services.telegram_group_parser import search_telegram_groups
    TELEGRAM_PARSER_AVAILABLE = True
except ImportError:
    logger.warning("Telegram group parser not available")
    TELEGRAM_PARSER_AVAILABLE = False


def get_groups_file() -> str:
    """Get the path to the groups data file"""
    try:
        return os.path.join(current_app.config.get('DATA_DIR', 'data'), 'groups.json')
    except RuntimeError:
        # Fallback when outside application context
        return os.path.join('data', 'groups.json')


def get_all_groups() -> List[Dict[str, Any]]:
    """
    Get all saved groups
    
    Returns:
        List of group dictionaries
    """
    groups_file = get_groups_file()
    ensure_data_directory()
    
    if not os.path.exists(groups_file):
        with open(groups_file, 'w') as f:
            json.dump([], f)
        return []
    
    try:
        with open(groups_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        try:
            current_app.logger.error(f"Error loading groups: {e}")
        except RuntimeError:
            logger.error(f"Error loading groups: {e}")
        return []


def save_groups(groups: List[Dict[str, Any]]) -> bool:
    """
    Save groups to file
    
    Args:
        groups: List of group dictionaries
        
    Returns:
        True if saved successfully, False otherwise
    """
    groups_file = get_groups_file()
    ensure_data_directory()
    
    try:
        with open(groups_file, 'w') as f:
            json.dump(groups, f, indent=2)
        return True
    except Exception as e:
        try:
            current_app.logger.error(f"Error saving groups: {e}")
        except RuntimeError:
            logger.error(f"Error saving groups: {e}")
        return False


def get_filtered_groups(list_id: str = 'all') -> List[Dict[str, Any]]:
    """
    Get groups, optionally filtered by list_id
    
    Args:
        list_id: The list ID to filter by, or 'all' for all groups
        
    Returns:
        List of filtered group dictionaries
    """
    groups = get_all_groups()
    
    if list_id != 'all':
        return [group for group in groups if group.get('list_id') == list_id]
    
    return groups


def create_groups(groups_data: List[Dict[str, Any]], list_id: str = 'main') -> List[Dict[str, Any]]:
    """
    Save one or more groups
    
    Args:
        groups_data: List of group data to save
        list_id: The list ID to assign to the groups
        
    Returns:
        List of saved group dictionaries
    """
    saved_groups = []
    all_groups = get_all_groups()
    
    # Get existing group usernames for deduplication
    existing_usernames = {group.get('username', '').lower() for group in all_groups if group.get('username')}
    
    for group_data in groups_data:
        # Skip if group with same username already exists (avoid duplicates)
        username = group_data.get('username', '').lower()
        if username and username in existing_usernames:
            continue
            
        # Create new group
        new_group = {
            "id": group_data.get('id', str(uuid.uuid4())),
            "telegram_id": group_data.get('telegram_id', 0),
            "title": group_data.get('title', ''),
            "username": group_data.get('username', ''),
            "members": group_data.get('members', 0),
            "online": group_data.get('online', 0),
            "language": group_data.get('language', 'en'),
            "description": group_data.get('description', ''),
            "list_id": list_id
        }
        
        all_groups.append(new_group)
        saved_groups.append(new_group)
        
        # Add to existing usernames for this batch
        if username:
            existing_usernames.add(username)
    
    if saved_groups:
        save_groups(all_groups)
    
    return saved_groups


def delete_group_by_id(group_id: str) -> bool:
    """
    Delete a group by its ID
    
    Args:
        group_id: ID of the group to delete
        
    Returns:
        True if deleted, False if not found
    """
    groups = get_all_groups()
    
    initial_count = len(groups)
    groups = [group for group in groups if group['id'] != group_id]
    
    if len(groups) == initial_count:
        return False
    
    save_groups(groups)
    
    return True


def search_telegram_groups(keywords: List[str], language: str = 'all') -> List[Dict[str, Any]]:
    """
    Search for Telegram groups based on keywords
    
    Args:
        keywords: List of keywords to search for
        language: Language filter (ISO code or 'all')
        
    Returns:
        List of found group dictionaries
    """
    # Check if the Telegram parser is available
    if TELEGRAM_PARSER_AVAILABLE:
        try:
            # Try to use the real Telegram search
            from app.services.telegram_group_parser import search_telegram_groups as telegram_search
            result = telegram_search(keywords, language)
            return result
        except Exception as e:
            try:
                current_app.logger.error(f"Error in search_telegram_groups: {e}")
            except RuntimeError:
                logger.error(f"Error in search_telegram_groups: {e}")
            # Return empty list if search fails
            return []
    else:
        # If the parser is not available, return empty list
        try:
            current_app.logger.error("Telegram parser not available")
        except RuntimeError:
            logger.error("Telegram parser not available")
        return []
    
def move_groups(group_ids: List[str], target_list_id: str) -> Dict[str, Any]:
    """
    Move groups to another list
    
    Args:
        group_ids: List of group IDs to move
        target_list_id: Target list ID
        
    Returns:
        Dictionary with the result of the operation
    """
    # Get all groups
    groups = get_all_groups()
    
    # Count of updated groups
    updated_count = 0
    
    # Update the list_id for each group in the list
    for group in groups:
        if group['id'] in group_ids:
            group['list_id'] = target_list_id
            updated_count += 1
    
    # Save the updated groups
    if updated_count > 0:
        save_groups(groups)
    
    return {
        "success": True,
        "updated_count": updated_count
    }