import os
import asyncio
import json
import uuid
from typing import List, Dict, Any, Optional
from telethon.sync import TelegramClient
from telethon.tl.functions.messages import SearchGlobalRequest
from telethon.tl.functions.contacts import SearchRequest
from telethon.tl.types import InputPeerEmpty, Channel, Chat, User, ChatEmpty
from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.functions.messages import GetFullChatRequest
from telethon.errors import FloodWaitError
from flask import current_app


# Use the session from the first available account
def get_active_session():
    """Get an active session file path for a Telegram account"""
    sessions_dir = os.path.join(os.getcwd(), "saved_sessions")
    
    if not os.path.exists(sessions_dir):
        return None
    
    # Look for session files
    session_files = [f for f in os.listdir(sessions_dir) if f.endswith('.session')]
    if not session_files:
        return None
    
    # Return the path to the first session
    return os.path.join(sessions_dir, session_files[0])


def load_api_credentials():
    """Load Telegram API credentials"""
    config_path = os.path.join(os.getcwd(), "data", "telegram_api.ini")
    
    # Default values
    api_id = current_app.config.get('TELEGRAM_API_ID', 149467)
    api_hash = current_app.config.get('TELEGRAM_API_HASH', '65f1b75a0b1d5a6461c1fc67b5514c1b')
    
    # Try to load from config file
    try:
        import configparser
        if os.path.exists(config_path):
            config = configparser.ConfigParser()
            config.read(config_path)
            api_id = config.getint('Telegram', 'api_id')
            api_hash = config.get('Telegram', 'api_hash')
    except Exception as e:
        current_app.logger.error(f"Error loading API credentials: {e}")
    
    return api_id, api_hash


async def search_telegram_groups_async(keywords: List[str], language: str = 'all', max_results: int = 50) -> List[Dict[str, Any]]:
    """
    Search for Telegram groups based on keywords using Telethon
    
    Args:
        keywords: List of keywords to search for
        language: Language filter (not implemented in API directly, will filter later)
        max_results: Maximum number of results to return
        
    Returns:
        List of found group dictionaries
    """
    # Get session and API credentials
    session_path = get_active_session()
    if not session_path:
        current_app.logger.error("No active Telegram session found")
        return []
    
    api_id, api_hash = load_api_credentials()
    
    found_groups = []
    try:
        # Connect to Telegram
        client = TelegramClient(session_path, api_id, api_hash)
        await client.connect()
        
        if not await client.is_user_authorized():
            current_app.logger.error("Telegram client not authorized")
            await client.disconnect()
            return []
        
        # Search for each keyword
        for keyword in keywords:
            try:
                # Method 1: Search global
                try:
                    global_results = await client(SearchGlobalRequest(
                        q=keyword,
                        filter=None,  # Can use InputMessagesFilterEmpty() for all types
                        min_date=None,
                        max_date=None,
                        offset_rate=0,
                        offset_peer=InputPeerEmpty(),
                        offset_id=0,
                        limit=20
                    ))
                    
                    for result in global_results.chats:
                        if isinstance(result, (Channel, Chat)) and not isinstance(result, ChatEmpty):
                            # Try to get more details about the channel/group
                            try:
                                if hasattr(result, 'megagroup') and result.megagroup:  # It's a supergroup
                                    full_channel = await client(GetFullChannelRequest(channel=result))
                                    group_info = {
                                        "id": str(uuid.uuid4()),
                                        "telegram_id": result.id,
                                        "title": result.title,
                                        "username": result.username if hasattr(result, 'username') else "",
                                        "members": full_channel.full_chat.participants_count,
                                        "online": getattr(full_channel.full_chat, 'online_count', 0),
                                        "language": detect_language(result.title, language),
                                        "description": full_channel.full_chat.about if hasattr(full_channel.full_chat, 'about') else ""
                                    }
                                    if group_info not in found_groups:
                                        found_groups.append(group_info)
                            except Exception as e:
                                current_app.logger.warning(f"Error getting details for group {result.title}: {e}")
                                # Still add basic information
                                group_info = {
                                    "id": str(uuid.uuid4()),
                                    "telegram_id": result.id,
                                    "title": result.title,
                                    "username": result.username if hasattr(result, 'username') else "",
                                    "members": 0,  # Unknown
                                    "online": 0,  # Unknown
                                    "language": detect_language(result.title, language),
                                    "description": ""
                                }
                                if group_info not in found_groups:
                                    found_groups.append(group_info)
                except Exception as e:
                    current_app.logger.warning(f"Error in global search for keyword '{keyword}': {e}")
                
                # Method 2: Search contacts
                try:
                    contact_results = await client(SearchRequest(
                        q=keyword,
                        limit=20
                    ))
                    
                    for chat in contact_results.chats:
                        if isinstance(chat, (Channel, Chat)) and not isinstance(chat, ChatEmpty):
                            try:
                                if hasattr(chat, 'megagroup') and chat.megagroup:  # It's a supergroup
                                    full_chat = await client(GetFullChannelRequest(channel=chat))
                                    group_info = {
                                        "id": str(uuid.uuid4()),
                                        "telegram_id": chat.id,
                                        "title": chat.title,
                                        "username": chat.username if hasattr(chat, 'username') else "",
                                        "members": full_chat.full_chat.participants_count,
                                        "online": getattr(full_chat.full_chat, 'online_count', 0),
                                        "language": detect_language(chat.title, language),
                                        "description": full_chat.full_chat.about if hasattr(full_chat.full_chat, 'about') else ""
                                    }
                                    if group_info not in found_groups:
                                        found_groups.append(group_info)
                            except Exception as e:
                                current_app.logger.warning(f"Error getting details for group {chat.title}: {e}")
                                # Still add basic information
                                group_info = {
                                    "id": str(uuid.uuid4()),
                                    "telegram_id": chat.id,
                                    "title": chat.title,
                                    "username": chat.username if hasattr(chat, 'username') else "",
                                    "members": 0,  # Unknown
                                    "online": 0,  # Unknown
                                    "language": detect_language(chat.title, language),
                                    "description": ""
                                }
                                if group_info not in found_groups:
                                    found_groups.append(group_info)
                except Exception as e:
                    current_app.logger.warning(f"Error in contact search for keyword '{keyword}': {e}")
                
                # Method 3: Check dialogues that match the keyword
                # This is slower but more reliable
                limit_counter = 0
                async for dialog in client.iter_dialogs():
                    if limit_counter >= 100:  # Limit the number of dialogs to check
                        break
                    
                    limit_counter += 1
                    entity = dialog.entity
                    
                    if isinstance(entity, (Channel, Chat)) and not isinstance(entity, ChatEmpty):
                        # Check if the group title matches the keyword (case-insensitive)
                        if keyword.lower() in entity.title.lower():
                            try:
                                if hasattr(entity, 'megagroup') and entity.megagroup:  # It's a supergroup
                                    full_entity = await client(GetFullChannelRequest(channel=entity))
                                    group_info = {
                                        "id": str(uuid.uuid4()),
                                        "telegram_id": entity.id,
                                        "title": entity.title,
                                        "username": entity.username if hasattr(entity, 'username') else "",
                                        "members": full_entity.full_chat.participants_count,
                                        "online": getattr(full_entity.full_chat, 'online_count', 0),
                                        "language": detect_language(entity.title, language),
                                        "description": full_entity.full_chat.about if hasattr(full_entity.full_chat, 'about') else ""
                                    }
                                    if group_info not in found_groups:
                                        found_groups.append(group_info)
                            except Exception as e:
                                current_app.logger.warning(f"Error getting details for group {entity.title}: {e}")
                                # Still add basic information
                                group_info = {
                                    "id": str(uuid.uuid4()),
                                    "telegram_id": entity.id,
                                    "title": entity.title,
                                    "username": entity.username if hasattr(entity, 'username') else "",
                                    "members": getattr(dialog.entity, 'participants_count', 0),
                                    "online": 0,  # Unknown
                                    "language": detect_language(entity.title, language),
                                    "description": ""
                                }
                                if group_info not in found_groups:
                                    found_groups.append(group_info)
            
            except FloodWaitError as e:
                current_app.logger.error(f"FloodWaitError: Need to wait {e.seconds} seconds")
                await asyncio.sleep(min(e.seconds, 10))  # Sleep for at most 10 seconds to not block the request too long
            
            except Exception as e:
                current_app.logger.error(f"Error searching for keyword '{keyword}': {e}")
            
            # Check if we have enough results
            if len(found_groups) >= max_results:
                break
        
        # Disconnect from Telegram
        await client.disconnect()
    
    except Exception as e:
        current_app.logger.error(f"Error in Telegram group search: {e}")
    
    # Apply language filter if specified
    if language != 'all':
        found_groups = [g for g in found_groups if g['language'] == language]
    
    # Limit the results
    return found_groups[:max_results]


def detect_language(text, target_language):
    """
    Basic language detection based on the text
    
    This is a simple implementation. In a real application, you'd use
    a proper language detection library like langdetect or fastText.
    """
    # For now, just use a simple mapping of language codes to typical characters
    if target_language == 'all':
        # If no specific language is requested, try to detect
        if any(c in text for c in 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'):
            return 'ru'
        elif any(c in text for c in 'áéíóúüñ'):
            return 'es'
        elif any(c in text for c in 'àâäèéêëîïôœùûüÿç'):
            return 'fr'
        elif any(c in text for c in 'äöüß'):
            return 'de'
        else:
            return 'en'  # Default to English
    else:
        # Return the target language if specified
        return target_language


def search_telegram_groups(keywords: List[str], language: str = 'all') -> List[Dict[str, Any]]:
    """
    Synchronous wrapper for the async search function
    """
    try:
        return asyncio.run(search_telegram_groups_async(keywords, language))
    except Exception as e:
        current_app.logger.error(f"Error in search_telegram_groups: {e}")
        return []


# Fallback search with mock data (use only if real search fails)
def fallback_search_telegram_groups(keywords: List[str], language: str = 'all') -> List[Dict[str, Any]]:
    """
    Fallback implementation that generates mock data for demo purposes
    Only use this if the real search fails completely or for testing
    """
    import random
    
    current_app.logger.warning("Using fallback (mock) group search - for testing only")
    
    found_groups = []
    languages = ['en', 'ru', 'es', 'fr', 'de'] if language == 'all' else [language]
    
    prefixes = ['', 'The ', 'Official ', 'Best ', 'Top ', 'Ultimate ']
    suffixes = ['Group', 'Community', 'Club', 'Network', 'Chat', 'Hub', 'Center', 'World']
    
    for keyword in keywords:
        # Generate 1-5 groups per keyword
        for _ in range(random.randint(1, 5)):
            # Create random group data
            prefix = random.choice(prefixes)
            suffix = random.choice(suffixes)
            group_name = f"{prefix}{keyword.capitalize()} {suffix}"
            
            username = f"{keyword.lower()}_{random.randint(1000, 9999)}"
            members = random.randint(100, 100000)
            online = random.randint(5, min(members // 10, 2000))
            group_language = random.choice(languages)
            
            group = {
                "id": str(uuid.uuid4()),
                "telegram_id": random.randint(1000000000, 9999999999),
                "title": group_name,
                "username": username,
                "members": members,
                "online": online,
                "language": group_language,
                "description": f"This is a group about {keyword}"
            }
            
            found_groups.append(group)
    
    return found_groups

