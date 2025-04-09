import os
import json
import uuid
import datetime
from typing import Dict, List, Any, Optional, Union
from flask import current_app

from app.utils.file_utils import ensure_data_directory


def get_templates_file() -> str:
    """Get the path to the templates data file"""
    try:
        return os.path.join(current_app.config.get('DATA_DIR', 'data'), 'message_templates.json')
    except RuntimeError:
        # Fallback when outside application context
        return os.path.join('data', 'message_templates.json')


def get_message_templates() -> Dict[str, Any]:
    """
    Get all message templates
    
    Returns:
        Dictionary of template IDs to template data
    """
    templates_file = get_templates_file()
    ensure_data_directory()
    
    if not os.path.exists(templates_file):
        with open(templates_file, 'w') as f:
            json.dump({}, f)
        return {}
    
    try:
        with open(templates_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        current_app.logger.error(f"Error loading templates: {e}")
        return {}


def get_message_template(template_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific message template
    
    Args:
        template_id: ID of the template to retrieve
        
    Returns:
        Template data dictionary or None if not found
    """
    templates = get_message_templates()
    return templates.get(template_id)


def save_message_template(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save a message template
    
    Args:
        data: Template data dictionary
        
    Returns:
        Saved template data dictionary
    """
    templates = get_message_templates()
    
    # Generate ID if new template
    if 'id' not in data:
        data['id'] = f"template_{uuid.uuid4()}"
    
    # Add timestamp if new
    if 'created_at' not in data:
        data['created_at'] = datetime.datetime.now().isoformat()
    
    # Add or update in templates dict
    templates[data['id']] = data
    
    # Save to file
    templates_file = get_templates_file()
    ensure_data_directory()
    
    try:
        with open(templates_file, 'w') as f:
            json.dump(templates, f, indent=2)
    except Exception as e:
        current_app.logger.error(f"Error saving templates: {e}")
    
    return data


def delete_message_template(template_id: str) -> bool:
    """
    Delete a message template
    
    Args:
        template_id: ID of the template to delete
        
    Returns:
        True if deleted, False if not found
    """
    templates = get_message_templates()
    
    if template_id not in templates:
        return False
    
    # Remove the template
    del templates[template_id]
    
    # Save to file
    templates_file = get_templates_file()
    ensure_data_directory()
    
    try:
        with open(templates_file, 'w') as f:
            json.dump(templates, f, indent=2)
        return True
    except Exception as e:
        current_app.logger.error(f"Error saving templates: {e}")
        return False


# Note: A real implementation would have a function to send messages to Telegram
# This would integrate with the Telegram API using the account sessions stored in the system
def send_message(account_id: str, group_id: str, message: str, image_urls: List[str] = None) -> Dict[str, Any]:
    """
    Send a message to a Telegram group
    
    Args:
        account_id: ID of the account to send from
        group_id: ID of the group to send to
        message: Message text
        image_urls: Optional list of image URLs to include
        
    Returns:
        Dictionary with result information
    """
    # This is a mock implementation that always succeeds
    # In a real application, this would connect to the Telegram API
    return {
        "success": True,
        "message": "Message sent successfully"
    }