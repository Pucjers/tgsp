import os
import asyncio
import json
import uuid
import time
import logging
from typing import List, Dict, Any, Optional
from telethon.sync import TelegramClient
from telethon.tl.functions.messages import SearchGlobalRequest
from telethon.tl.functions.contacts import SearchRequest
from telethon.tl.types import InputPeerEmpty, Channel, Chat, User, ChatEmpty
from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.functions.messages import GetFullChatRequest
from telethon.errors import FloodWaitError

# Setup a basic logger for use outside application context
logger = logging.getLogger(__name__)

# Import langdetect for better language detection
try:
    from langdetect import detect as langdetect_detect, LangDetectException
    LANGDETECT_AVAILABLE = True
except ImportError:
    LANGDETECT_AVAILABLE = False
    logger.warning("langdetect library not available, using basic language detection")


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
    api_id = 149467
    api_hash = "65f1b75a0b1d5a6461c1fc67b5514c1b"
    
    # Try to load from config file
    try:
        import configparser
        if os.path.exists(config_path):
            config = configparser.ConfigParser()
            config.read(config_path)
            api_id = config.getint('Telegram', 'api_id')
            api_hash = config.get('Telegram', 'api_hash')
    except Exception as e:
        logger.error(f"Error loading API credentials: {e}")
    
    return api_id, api_hash


def get_cached_search_results(keywords: List[str], language: str) -> Optional[List[Dict[str, Any]]]:
    """
    Get cached search results for the given keywords and language
    
    Args:
        keywords: List of keywords used for the search
        language: Language filter applied to the search
        
    Returns:
        Cached search results or None if no valid cache exists
    """
    # Default data directory
    data_dir = os.path.join(os.getcwd(), "data")
    cache_file = os.path.join(data_dir, 'search_cache.json')
    
    # Try to get data directory from app config if in application context
    try:
        from flask import current_app
        data_dir = current_app.config.get('DATA_DIR', data_dir)
        cache_file = os.path.join(data_dir, 'search_cache.json')
    except (ImportError, RuntimeError):
        pass  # Use default if not in app context
    
    if not os.path.exists(cache_file):
        return None
        
    try:
        with open(cache_file, 'r') as f:
            cache = json.load(f)
            
        # Create a cache key from keywords and language
        # Sort keywords to ensure consistent keys regardless of order
        cache_key = f"{','.join(sorted(keywords))}-{language}"
        
        # Check if we have cached results and they're not expired
        if cache_key in cache:
            entry = cache[cache_key]
            timestamp = entry.get('timestamp', 0)
            # Use a 24-hour cache expiration by default
            cache_ttl = 86400  # 24 hours in seconds
            
            try:
                from flask import current_app
                cache_ttl = current_app.config.get('SEARCH_CACHE_TTL', cache_ttl)
            except (ImportError, RuntimeError):
                pass  # Use default if not in app context
            
            if time.time() - timestamp < cache_ttl:
                logger.info(f"Using cached results for {cache_key} (age: {int((time.time() - timestamp) / 60)} minutes)")
                return entry.get('results', [])
            else:
                logger.info(f"Cache expired for {cache_key}")
                
        return None
    except Exception as e:
        logger.error(f"Error reading search cache: {e}")
        return None


def save_search_results_to_cache(keywords: List[str], language: str, results: List[Dict[str, Any]]) -> bool:
    """
    Save search results to cache
    
    Args:
        keywords: List of keywords used for the search
        language: Language filter applied to the search
        results: Search results to cache
        
    Returns:
        True if saved successfully, False otherwise
    """
    # Default data directory
    data_dir = os.path.join(os.getcwd(), "data")
    cache_file = os.path.join(data_dir, 'search_cache.json')
    
    # Try to get data directory from app config if in application context
    try:
        from flask import current_app
        data_dir = current_app.config.get('DATA_DIR', data_dir)
        cache_file = os.path.join(data_dir, 'search_cache.json')
    except (ImportError, RuntimeError):
        pass  # Use default if not in app context
    
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(cache_file), exist_ok=True)
        
        # Load existing cache
        cache = {}
        if os.path.exists(cache_file):
            with open(cache_file, 'r') as f:
                try:
                    cache = json.load(f)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON in cache file, creating new cache")
        
        # Create a cache key from keywords and language
        cache_key = f"{','.join(sorted(keywords))}-{language}"
        
        # Save results with timestamp
        cache[cache_key] = {
            'timestamp': time.time(),
            'results': results
        }
        
        # Save cache back to file
        with open(cache_file, 'w') as f:
            json.dump(cache, f, indent=2)
        
        logger.info(f"Saved {len(results)} results to cache for {cache_key}")
        return True
            
    except Exception as e:
        logger.error(f"Error saving search cache: {e}")
        return False


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
    # Check for cached results first
    cached_results = get_cached_search_results(keywords, language)
    if cached_results is not None:
        return cached_results
    
    # Get session and API credentials
    session_path = get_active_session()
    if not session_path:
        logger.error("No active Telegram session found")
        return []
    
    api_id, api_hash = load_api_credentials()
    
    found_groups = []
    try:
        # Connect to Telegram
        client = TelegramClient(session_path, api_id, api_hash)
        await client.connect()
        
        if not await client.is_user_authorized():
            logger.error("Telegram client not authorized")
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
                                logger.warning(f"Error getting details for group {result.title}: {e}")
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
                    logger.warning(f"Error in global search for keyword '{keyword}': {e}")
                
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
                                logger.warning(f"Error getting details for group {chat.title}: {e}")
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
                    logger.warning(f"Error in contact search for keyword '{keyword}': {e}")
                
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
                                logger.warning(f"Error getting details for group {entity.title}: {e}")
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
                logger.error(f"FloodWaitError: Need to wait {e.seconds} seconds")
                await asyncio.sleep(min(e.seconds, 10))  # Sleep for at most 10 seconds to not block the request too long
            
            except Exception as e:
                logger.error(f"Error searching for keyword '{keyword}': {e}")
            
            # Check if we have enough results
            if len(found_groups) >= max_results:
                break
        
        # Disconnect from Telegram
        await client.disconnect()
    
    except Exception as e:
        logger.error(f"Error in Telegram group search: {e}")
    
    # Apply language filter if specified
    if language != 'all':
        found_groups = [g for g in found_groups if g['language'] == language]
    
    # Limit the results
    filtered_results = found_groups[:max_results]
    
    # Cache the results for future use
    save_search_results_to_cache(keywords, language, filtered_results)
    
    return filtered_results


def detect_language(text: str, target_language: str) -> str:
    """
    Detect language of text using langdetect library if available, 
    or fall back to basic detection
    
    Args:
        text: Text to detect language for
        target_language: Target language or 'all'
        
    Returns:
        Detected language code or target_language if specified
    """
    # If a specific language is requested, just return it
    if target_language != 'all':
        return target_language
    
    # Try to detect language using langdetect if available
    if LANGDETECT_AVAILABLE:
        try:
            # We need enough text to detect language reliably
            if len(text) >= 10:  
                return langdetect_detect(text)
            # If text is too short, fall back to basic detection
        except LangDetectException:
            # If detection fails, fall back to basic detection
            pass
    
    # Basic language detection as fallback
    text_lower = text.lower()
    
    # Check for language-specific characters
    if any(c in text_lower for c in 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'):
        return 'ru'
    elif any(c in text_lower for c in 'áéíóúüñ'):
        return 'es'
    elif any(c in text_lower for c in 'àâäèéêëîïôœùûüÿç'):
        return 'fr'
    elif any(c in text_lower for c in 'äöüß'):
        return 'de'
    else:
        return 'en'  # Default to English


def search_telegram_groups(keywords: List[str], language: str = 'all') -> List[Dict[str, Any]]:
    """
    Synchronous wrapper for the async search function
    """
    try:
        return asyncio.run(search_telegram_groups_async(keywords, language))
    except Exception as e:
        logger.error(f"Error in search_telegram_groups: {e}")
        return []