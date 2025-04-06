import os
import json
import uuid
import random
from typing import List, Dict, Any, Optional, Union
from flask import current_app

from app.utils.file_utils import ensure_data_directory


def get_groups_file() -> str:
    """Get the path to the groups data file"""
    return os.path.join(current_app.config.get('DATA_DIR', 'data'), 'groups.json')


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
        current_app.logger.error(f"Error loading groups: {e}")
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
        current_app.logger.error(f"Error saving groups: {e}")
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
    existing_usernames = {group.get('username', '').lower() for group in all_groups}
    
    for group_data in groups_data:
        # Skip if group with same username already exists
        if group_data.get('username', '').lower() in existing_usernames:
            continue
            
        # Create new group
        new_group = {
            "id": str(uuid.uuid4()),
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
        existing_usernames.add(new_group['username'].lower())
    
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
    
    Note: This is a mock implementation that generates random groups.
    In a real application, this would call the Telegram API or scrape group data.
    
    Args:
        keywords: List of keywords to search for
        language: Language filter (ISO code or 'all')
        
    Returns:
        List of found group dictionaries
    """
    # In a real application, this would interact with Telegram API
    # This is just a mock implementation
    
    found_groups = []
    languages = ['en', 'ru', 'es', 'fr', 'de'] if language == 'all' else [language]
    
    for keyword in keywords:
        # Generate 1-5 groups per keyword
        for _ in range(random.randint(1, 5)):
            # Create random group data
            group_name = generate_random_group_name(keyword)
            username = f"{keyword.lower()}_{random.randint(1000, 9999)}"
            members = random.randint(100, 100000)
            online = random.randint(5, min(members // 10, 2000))
            group_language = random.choice(languages)
            
            group = {
                "id": str(uuid.uuid4()),
                "title": group_name,
                "username": username,
                "members": members,
                "online": online,
                "language": group_language,
                "description": f"This is a group about {keyword}"
            }
            
            found_groups.append(group)
    
    return found_groups


def generate_random_group_name(keyword: str) -> str:
    """Generate a random group name based on a keyword"""
    prefixes = ['', 'The ', 'Official ', 'Best ', 'Top ', 'Ultimate ']
    suffixes = ['Group', 'Community', 'Club', 'Network', 'Chat', 'Hub', 'Center', 'World']
    
    prefix = random.choice(prefixes)
    suffix = random.choice(suffixes)
    
    return f"{prefix}{keyword.capitalize()} {suffix}"