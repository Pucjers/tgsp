"""
Message Formatter Service for Telegram broadcasting.

This module provides functions for template-based message formatting,
including support for randomized text variants and dynamic variable replacement.
"""

import re
import random
import datetime
from typing import Dict, Any, Optional


def format_message_with_template_tags(message: str, account_data: Dict[str, Any] = None, 
                                     chat_name: str = None) -> str:
    """
    Format a message by replacing template tags with actual values.
    
    Supported tags:
    - {name} - Account name
    - {username} - Account username
    - {phone} - Account phone number
    - {chat} - Chat/group name
    - {date} - Current date (YYYY-MM-DD)
    - {time} - Current time (HH:MM:SS)
    - [variant1|variant2|variant3] - Randomly selects one of the variants
    
    Args:
        message: The template message to format
        account_data: Dictionary containing account information
        chat_name: Name of the chat/group
        
    Returns:
        The formatted message
    """
    if not message:
        return ""
        
    # If no account data provided, use empty dict
    if account_data is None:
        account_data = {}
        
    formatted = message
    
    # Replace account-specific placeholders
    formatted = formatted.replace('{name}', account_data.get('name', ''))
    formatted = formatted.replace('{username}', account_data.get('username', ''))
    formatted = formatted.replace('{phone}', account_data.get('phone', ''))
    
    # Replace chat name
    if chat_name:
        formatted = formatted.replace('{chat}', chat_name)
    else:
        formatted = formatted.replace('{chat}', '')
    
    # Replace date/time placeholders
    now = datetime.datetime.now()
    formatted = formatted.replace('{date}', now.strftime('%Y-%m-%d'))
    formatted = formatted.replace('{time}', now.strftime('%H:%M:%S'))
    
    # Process random variants with [option1|option2|option3] syntax
    # Also supports both [option1/option2/option3] and [option1][option2][option3] formats
    
    # First, handle the pipe (|) separator
    formatted = process_variants(formatted, '|')
    
    # Then handle the slash (/) separator if any remain
    formatted = process_variants(formatted, '/')
    
    return formatted


def process_variants(text: str, separator: str) -> str:
    """
    Process text variants with the given separator.
    
    Args:
        text: Text to process
        separator: Separator character between variants
        
    Returns:
        Processed text with variants replaced
    """
    result = text
    
    # Keep processing until all variants are handled
    while '[' in result and ']' in result:
        start = result.find('[')
        end = result.find(']', start)
        
        if start != -1 and end != -1:
            options_text = result[start+1:end]
            
            # Only process if the separator is present
            if separator in options_text:
                options = options_text.split(separator)
                
                if options:
                    chosen_option = random.choice(options)
                    result = result[:start] + chosen_option + result[end+1:]
                else:
                    # If no options found, just remove the brackets
                    result = result[:start] + result[start+1:end] + result[end+1:]
            else:
                # If this separator isn't in the brackets, just move past this bracket pair
                # by replacing with a special marker that won't be processed again
                marker = f"__PROCESSED_{start}_{end}__"
                result = result[:start] + marker + result[end+1:]
                
        else:
            # Unmatched brackets, break to avoid infinite loop
            break
    
    # Restore any markers we added
    pattern = r'__PROCESSED_\d+_\d+__'
    for marker in re.findall(pattern, result):
        # Extract the original content (with brackets)
        start_end = marker.replace('__PROCESSED_', '').replace('__', '')
        try:
            start, end = map(int, start_end.split('_'))
            original = text[start:end+1]
            result = result.replace(marker, original)
        except (ValueError, IndexError):
            continue
    
    return result


def get_random_variations(message: str, count: int = 3) -> list:
    """
    Generate multiple random variations of a template message.
    
    Args:
        message: The template message
        count: Number of variations to generate
        
    Returns:
        List of message variations
    """
    variations = []
    for _ in range(count):
        variations.append(format_message_with_template_tags(message))
    return variations