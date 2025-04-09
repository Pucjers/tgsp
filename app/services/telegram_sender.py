import os
import asyncio
import logging
from typing import List, Dict, Any, Optional, Union
import datetime

from telethon import TelegramClient
from telethon.errors import (
    FloodWaitError, 
    ChatAdminRequiredError,
    ChannelPrivateError,
    UserBannedInChannelError
)
from flask import current_app

# Setup a basic logger
logger = logging.getLogger(__name__)

async def send_message_async(
    session_path: str,
    group_id: Union[int, str],
    message_text: str,
    image_paths: List[str] = None
) -> Dict[str, Any]:
    """
    Send a message to a Telegram group using Telethon client
    
    Args:
        session_path: Path to the .session file for the account
        group_id: The group ID or username to send to
        message_text: Message text to send
        image_paths: Optional list of image paths to send
        
    Returns:
        Dictionary with result information
    """
    client = None
    try:
        # Load API credentials
        api_id, api_hash = _load_api_credentials()
        
        # Check if session file exists
        if not os.path.exists(session_path):
            logger.error(f"Session file not found: {session_path}")
            return {
                "success": False,
                "error": "Session file not found"
            }
        
        # Extract session name (without .session extension)
        session_name = os.path.splitext(os.path.basename(session_path))[0]
        session_dir = os.path.dirname(session_path)
        
        # Connect to Telegram using just the session name and path
        logger.info(f"Connecting to Telegram with session name: {session_name} in directory: {session_dir}")
        
        # Create client with a connection timeout
        client = TelegramClient(
            os.path.join(session_dir, session_name), 
            api_id, 
            api_hash,
            connection_retries=1,  # Reduce retries
            retry_delay=1  # 1 second delay between retries
        )
        
        # Set a timeout for the connection
        try:
            logger.info("Attempting to connect with timeout...")
            # Use asyncio.wait_for to set a timeout on the connection
            await asyncio.wait_for(client.connect(), timeout=10.0)  # 10 second timeout
            logger.info("Connection successful")
        except asyncio.TimeoutError:
            logger.error("Connection timed out after 10 seconds")
            if client:
                await client.disconnect()
            return {
                "success": False,
                "error": "Connection to Telegram timed out"
            }
        
        # Check if the client is authorized with timeout
        try:
            logger.info("Checking authorization with timeout...")
            is_authorized = await asyncio.wait_for(client.is_user_authorized(), timeout=5.0)
            if not is_authorized:
                await client.disconnect()
                logger.error(f"Client is not authorized: {session_path}")
                return {
                    "success": False,
                    "error": "Client is not authorized"
                }
            logger.info("Authorization successful")
        except asyncio.TimeoutError:
            logger.error("Authorization check timed out after 5 seconds")
            if client:
                await client.disconnect()
            return {
                "success": False,
                "error": "Authorization check timed out"
            }
        
        # Try to get the group entity
        try:
            # Try to interpret group_id as a string (username)
            if isinstance(group_id, str):
                if group_id.isdigit():
                    # If it's all digits, try to convert to int
                    group_id = int(group_id)
                else:
                    # Ensure username has @ prefix
                    if not group_id.startswith('@'):
                        group_id = f"@{group_id}"
            
            logger.info(f"Attempting to get entity for: {group_id}")
            # Get the entity with timeout
            try:
                entity = await asyncio.wait_for(client.get_entity(group_id), timeout=10.0)
                logger.info(f"Found entity: {entity.id} ({getattr(entity, 'title', '?')})")
            except asyncio.TimeoutError:
                await client.disconnect()
                logger.error(f"Timed out getting entity for {group_id}")
                return {
                    "success": False,
                    "error": f"Timed out getting group info: {group_id}"
                }
            
        except Exception as e:
            await client.disconnect()
            logger.error(f"Error getting group entity: {e}")
            return {
                "success": False,
                "error": f"Could not find group: {str(e)}"
            }
        
        # If we have images, send them with the message
        try:
            if image_paths and len(image_paths) > 0:
                logger.info(f"Sending message with {len(image_paths)} images")
                
                # Convert image paths to absolute paths if they are relative
                processed_paths = []
                for path in image_paths:
                    # If it's a URL that points to our uploads directory
                    if path.startswith('/uploads/'):
                        # Convert to absolute path
                        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
                        file_name = os.path.basename(path)
                        absolute_path = os.path.abspath(os.path.join(upload_folder, file_name))
                        processed_paths.append(absolute_path)
                    else:
                        processed_paths.append(path)
                
                logger.info(f"Processed image paths: {processed_paths}")
                
                # Log if files exist
                valid_paths = []
                for path in processed_paths:
                    if os.path.exists(path):
                        logger.info(f"Image file found: {path} ({os.path.getsize(path)} bytes)")
                        valid_paths.append(path)
                    else:
                        logger.warning(f"Image file not found: {path}")
                
                # Skip sending if no valid images found
                if not valid_paths:
                    logger.warning("No valid image files found, sending text only")
                    try:
                        result = await asyncio.wait_for(
                            client.send_message(
                                entity,
                                message_text,
                                parse_mode='html'
                            ),
                            timeout=15.0  # 15 second timeout for sending text
                        )
                        
                        logger.info(f"Text message sent successfully: {result.id}")
                    except asyncio.TimeoutError:
                        logger.error("Timed out sending text message")
                        await client.disconnect()
                        return {
                            "success": False,
                            "error": "Timed out sending text message"
                        }
                else:
                    # Send message with media with timeout
                    try:
                        logger.info("Sending message with images (with timeout)...")
                        # If there's only one image, send it directly
                        if len(valid_paths) == 1:
                            result = await asyncio.wait_for(
                                client.send_file(
                                    entity,
                                    valid_paths[0],  # Send single file
                                    caption=message_text,
                                    parse_mode='html'
                                ),
                                timeout=30.0  # 30 second timeout for sending files
                            )
                        else:
                            # For multiple images, we need to send them as an album
                            # Telethon requires special handling for albums
                            from telethon.tl.types import InputMediaUploadedPhoto, InputMediaUploadedDocument
                            
                            # Create media list
                            media = []
                            for path in valid_paths:
                                # Determine if it's a photo or document based on extension
                                ext = os.path.splitext(path)[1].lower()
                                if ext in ['.jpg', '.jpeg', '.png', '.webp']:
                                    media.append(InputMediaUploadedPhoto(
                                        file=await client.upload_file(path)
                                    ))
                                else:
                                    media.append(InputMediaUploadedDocument(
                                        file=await client.upload_file(path),
                                        mime_type='application/octet-stream',
                                        attributes=[]
                                    ))
                            
                            # Send the album with caption only on the first media item
                            result = await asyncio.wait_for(
                                client.send_message(
                                    entity,
                                    message=message_text,
                                    file=media,
                                    parse_mode='html'
                                ),
                                timeout=60.0  # longer timeout for albums
                            )
                        
                        logger.info(f"Message with media sent successfully: {result.id}")
                    except asyncio.TimeoutError:
                        logger.error("Timed out sending message with images")
                        await client.disconnect()
                        return {
                            "success": False,
                            "error": "Timed out sending message with images"
                        }
                
            else:
                # Send text message only with timeout
                logger.info(f"Sending text message")
                try:
                    result = await asyncio.wait_for(
                        client.send_message(
                            entity,
                            message_text,
                            parse_mode='html'
                        ),
                        timeout=15.0  # 15 second timeout for sending text
                    )
                    
                    logger.info(f"Text message sent successfully: {result.id}")
                except asyncio.TimeoutError:
                    logger.error("Timed out sending text message")
                    await client.disconnect()
                    return {
                        "success": False,
                        "error": "Timed out sending text message"
                    }
                
            # Disconnect the client
            await client.disconnect()
            
            return {
                "success": True,
                "message": "Message sent successfully",
                "message_id": getattr(result, 'id', None)
            }
            
        except FloodWaitError as e:
            # Telegram is asking us to wait
            await client.disconnect()
            logger.error(f"FloodWaitError: Need to wait {e.seconds} seconds")
            
            # Calculate the time when the account will be available again
            cooldown_until = datetime.datetime.now() + datetime.timedelta(seconds=e.seconds)
            
            return {
                "success": False,
                "error": f"Rate limited: need to wait {e.seconds} seconds",
                "cooldown_until": cooldown_until.isoformat(),
                "error_type": "flood_wait"
            }
            
        except ChatAdminRequiredError:
            await client.disconnect()
            logger.error("ChatAdminRequiredError: Need admin rights")
            return {
                "success": False,
                "error": "Need admin rights to send messages to this group",
                "error_type": "admin_required"
            }
            
        except ChannelPrivateError:
            await client.disconnect()
            logger.error("ChannelPrivateError: Channel is private")
            return {
                "success": False,
                "error": "Cannot access this private channel/group",
                "error_type": "channel_private"
            }
            
        except UserBannedInChannelError:
            await client.disconnect()
            logger.error("UserBannedInChannelError: User is banned")
            return {
                "success": False,
                "error": "This account is banned from the group",
                "error_type": "user_banned"
            }
            
        except Exception as e:
            await client.disconnect()
            logger.error(f"Error sending message: {e}")
            return {
                "success": False,
                "error": f"Failed to send message: {str(e)}",
                "error_type": "general_error"
            }
            
    except Exception as e:
        logger.error(f"Unexpected error in send_message_async: {e}")
        try:
            if 'client' in locals() and client.is_connected():
                await client.disconnect()
        except:
            pass
            
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }

def _load_api_credentials():
    """Load Telegram API credentials"""
    # Try to load from app config first
    try:
        api_id = current_app.config.get('TELEGRAM_API_ID')
        api_hash = current_app.config.get('TELEGRAM_API_HASH')
        
        if api_id and api_hash:
            return int(api_id), api_hash
    except (RuntimeError, ValueError):
        pass
    
    # Fallback to config file
    try:
        import configparser
        config_path = os.path.join(os.getcwd(), "data", "telegram_api.ini")
        
        if os.path.exists(config_path):
            config = configparser.ConfigParser()
            config.read(config_path)
            api_id = config.getint('Telegram', 'api_id')
            api_hash = config.get('Telegram', 'api_hash')
            return api_id, api_hash
    except Exception as e:
        logger.error(f"Error loading API credentials from config: {e}")
    
    # Use default values
    logger.warning("Using default API credentials")
    return 149467, "65f1b75a0b1d5a6461c1fc67b5514c1b"  # Public test keys

def send_message(
    session_path: str,
    group_id: Union[int, str],
    message_text: str,
    image_paths: List[str] = None
) -> Dict[str, Any]:
    """
    Synchronous wrapper for the async send_message_async function
    """
    result = asyncio.run(send_message_async(
        session_path=session_path,
        group_id=group_id,
        message_text=message_text,
        image_paths=image_paths
    ))
    
    return result