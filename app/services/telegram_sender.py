import os
import asyncio
import logging
import datetime
import configparser
from typing import List, Dict, Any, Optional, Union, Tuple

# Try to import Telethon
try:
    from telethon import TelegramClient
    from telethon.errors import (
        FloodWaitError, 
        ChatAdminRequiredError,
        ChannelPrivateError,
        UserBannedInChannelError,
        AuthKeyUnregisteredError,
        SessionPasswordNeededError
    )
    from telethon.tl.types import InputMediaUploadedPhoto, InputMediaUploadedDocument, InputChannel
    from telethon.tl.functions.channels import JoinChannelRequest
    TELETHON_AVAILABLE = True
except ImportError:
    TELETHON_AVAILABLE = False

# Configure logging
logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Directory constants
SESSIONS_DIR = os.path.join(os.getcwd(), "saved_sessions")
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")

# Default API credentials
DEFAULT_API_ID = 149467
DEFAULT_API_HASH = "65f1b75a0b1d5a6461c1fc67b5514c1b"

def load_api_credentials() -> Tuple[int, str]:
    """
    Load Telegram API credentials from config file or use defaults
    
    Returns:
        Tuple containing (api_id, api_hash)
    """
    config_path = os.path.join(os.getcwd(), "data", "telegram_api.ini")
    
    # Try to load from config file
    try:
        if os.path.exists(config_path):
            config = configparser.ConfigParser()
            config.read(config_path)
            api_id = config.getint('Telegram', 'api_id')
            api_hash = config.get('Telegram', 'api_hash')
            return api_id, api_hash
    except Exception as e:
        logger.error(f"Error loading API credentials: {e}")
    
    # Use default values
    logger.warning("Using default API credentials")
    return DEFAULT_API_ID, DEFAULT_API_HASH

async def send_message_async(
    session_path: str,
    group_id: Union[int, str],
    message_text: str,
    image_paths: List[str] = None,
    proxy_config: Optional[Dict[str, Any]] = None,
    timeout: int = 60
) -> Dict[str, Any]:
    """
    Send a message to a Telegram group using Telethon client
    
    Args:
        session_path: Path to the .session file for the account
        group_id: The group ID or username to send to
        message_text: Message text to send
        image_paths: Optional list of image paths to send
        proxy_config: Optional proxy configuration
        timeout: Timeout in seconds for the operation
        
    Returns:
        Dictionary with result information
    """
    if not TELETHON_AVAILABLE:
        return {
            "success": False,
            "error": "Telethon library is not available"
        }
    
    client = None
    try:
        # Load API credentials
        api_id, api_hash = load_api_credentials()
        
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
        
        logger.info(f"Connecting to Telegram with session name: {session_name} in directory: {session_dir}")
        
        # Create client with a connection timeout
        client = TelegramClient(
            os.path.join(session_dir, session_name), 
            api_id, 
            api_hash,
            proxy=proxy_config,
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
        try:
            if hasattr(entity, 'username') and entity.username:
                logger.info(f"Attempting to join group: {entity.username}")
                await client(JoinChannelRequest(entity))
                logger.info(f"Successfully joined group: {entity.username}")
            elif hasattr(entity, 'access_hash') and entity.access_hash:
                logger.info(f"Attempting to join group with access hash")
                await client(JoinChannelRequest(InputChannel(entity.id, entity.access_hash)))
                logger.info(f"Successfully joined group with access hash")
            else:
                logger.warning("Unable to determine how to join this group/channel")
        except Exception as join_error:
            # If we can't join, log it but continue trying to send the message
            # as the error might be because we're already a member
            logger.warning(f"Error joining group: {join_error}")
        # If we have images, send them with the message
        try:
            if image_paths and len(image_paths) > 0:
                logger.info(f"Sending message with {len(image_paths)} images")
                
                # Check each image path to ensure it exists
                valid_paths = []
                for path in image_paths:
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
                            # Create media list
                            media = []
                            for path in valid_paths:
                                # Determine if it's a photo or document based on extension
                                ext = os.path.splitext(path)[1].lower()
                                if ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif']:
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
            
        except SessionPasswordNeededError:
            await client.disconnect()
            logger.error("SessionPasswordNeededError: Two-factor authentication required")
            return {
                "success": False,
                "error": "Two-factor authentication is enabled on this account",
                "error_type": "2fa_required"
            }
            
        except AuthKeyUnregisteredError:
            await client.disconnect()
            logger.error("AuthKeyUnregisteredError: Session is no longer valid")
            return {
                "success": False,
                "error": "Session is no longer valid",
                "error_type": "session_invalid"
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
            if 'client' in locals() and client and client.is_connected():
                await client.disconnect()
        except:
            pass
            
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }

def send_message(
    session_path: str,
    group_id: Union[int, str],
    message_text: str,
    image_paths: List[str] = None,
    proxy_config: Optional[Dict[str, Any]] = None,
    timeout: int = 60
) -> Dict[str, Any]:
    """
    Synchronous wrapper for the async send_message_async function
    
    Args:
        session_path: Path to the .session file for the account
        group_id: The group ID or username to send to
        message_text: Message text to send
        image_paths: Optional list of image paths to send
        proxy_config: Optional proxy configuration
        timeout: Timeout in seconds for the operation
        
    Returns:
        Dictionary with result information
    """
    if not TELETHON_AVAILABLE:
        return {
            "success": False,
            "error": "Telethon library is not available"
        }
    
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            send_message_async(
                session_path=session_path,
                group_id=group_id,
                message_text=message_text,
                image_paths=image_paths,
                proxy_config=proxy_config,
                timeout=timeout
            )
        )
        loop.close()
        return result
    except Exception as e:
        logger.error(f"Error in send_message wrapper: {e}")
        return {
            "success": False,
            "error": f"Error in message sending wrapper: {str(e)}"
        }

class BroadcastManager:
    """
    Manages a broadcast campaign to multiple groups using multiple accounts.
    
    This class handles scheduling messages, selecting accounts based on limits,
    tracking cooldowns, and ensuring accounts are not overused.
    """
    
    def __init__(
        self,
        accounts: List[Dict[str, Any]],
        groups: List[Dict[str, Any]],
        messages: List[Dict[str, Any]],
        account_metas: Dict[str, Dict[str, Any]],
        proxy_configs: Dict[str, Dict[str, Any]],
        interval_min: int = 30,
        interval_max: int = 60,
        randomize_messages: bool = True,
        randomize_accounts: bool = True,
        continue_on_errors: bool = False
    ):
        """
        Initialize the broadcast manager
        
        Args:
            accounts: List of account dictionaries
            groups: List of group dictionaries
            messages: List of message dictionaries (text and optional media)
            account_metas: Dict of account metadata keyed by account ID
            proxy_configs: Dict of proxy configurations keyed by proxy ID
            interval_min: Minimum interval between messages in seconds
            interval_max: Maximum interval between messages in seconds
            randomize_messages: Whether to randomize message order
            randomize_accounts: Whether to randomize account order
            continue_on_errors: Whether to continue on errors
        """
        self.accounts = accounts
        self.groups = groups
        self.messages = messages
        self.account_metas = account_metas
        self.proxy_configs = proxy_configs
        self.interval_min = interval_min
        self.interval_max = interval_max
        self.randomize_messages = randomize_messages
        self.randomize_accounts = randomize_accounts
        self.continue_on_errors = continue_on_errors
        
        # Stats tracking
        self.total_messages = len(groups) * len(messages)
        self.sent_count = 0
        self.errors = []
        self.start_time = None
        self.end_time = None
        self.is_running = False
        self.is_paused = False
        
        # Queue for scheduled messages
        self.message_queue = []
        
        # Account usage tracking
        self.account_usage = {}
        for account in accounts:
            self.account_usage[account["id"]] = {
                "messages_sent": 0,
                "last_used": None,
                "cooldown_until": account.get("cooldown_until"),
                "limits": account.get("limits", {
                    "daily_messages": 50
                })
            }
    
    def prepare_broadcast(self):
        """
        Prepare the broadcast by initializing the message queue
        """
        import random
        
        if self.randomize_messages:
            import random
            random.shuffle(self.messages)
            
        if self.randomize_accounts:
            import random
            random.shuffle(self.accounts)
            
        # Initialize schedule
        self.message_queue = []
        
        # Generate schedule based on messages, groups and accounts
        for group in self.groups:
            for message in self.messages:
                self.message_queue.append({
                    "group": group,
                    "message": message,
                    "sent": False,
                    "error": None,
                    "account_id": None
                })
                
        # Optionally shuffle the queue
        if self.randomize_messages:
            random.shuffle(self.message_queue)
    
    def get_available_account(self):
        """
        Get an available account that hasn't reached its limits
        
        Returns:
            Account dictionary or None if no accounts available
        """
        import datetime
        
        now = datetime.datetime.now()
        
        for account in self.accounts:
            account_id = account["id"]
            usage = self.account_usage[account_id]
            
            # Skip accounts on cooldown
            if usage["cooldown_until"]:
                cooldown = datetime.datetime.fromisoformat(usage["cooldown_until"])
                if cooldown > now:
                    continue
                    
            # Skip accounts that have reached their daily limits
            daily_limit = usage["limits"].get("daily_messages", 50)
            if usage["messages_sent"] >= daily_limit:
                continue
                
            # Skip accounts that have been used recently (need some rest)
            if usage["last_used"]:
                last_used = datetime.datetime.fromisoformat(usage["last_used"])
                # Ensure at least 5 seconds between messages from same account
                if (now - last_used).total_seconds() < 5:
                    continue
                    
            # Account is available
            return account
            
        # No accounts available
        return None
    
    async def run(self, on_update=None):
        """
        Run the broadcast campaign
        
        Args:
            on_update: Optional callback function to receive progress updates
        """
        if not TELETHON_AVAILABLE:
            if on_update:
                on_update({
                    "status": "error",
                    "error": "Telethon library is not available",
                    "progress": 0,
                    "sent": 0,
                    "total": self.total_messages
                })
            return {
                "success": False,
                "error": "Telethon library is not available"
            }
            
        import datetime
        import random
        import asyncio
        
        self.start_time = datetime.datetime.now()
        self.is_running = True
        self.is_paused = False
        
        # Prepare the broadcast
        self.prepare_broadcast()
        
        # Process the queue
        for i, item in enumerate(self.message_queue):
            # Check if broadcast was stopped
            if not self.is_running:
                break
                
            # Check if broadcast was paused
            while self.is_paused:
                await asyncio.sleep(1)
                
                # Check if broadcast was stopped during pause
                if not self.is_running:
                    break
            
            # Get an available account
            account = self.get_available_account()
            
            if not account:
                # No accounts available, wait and try again
                if on_update:
                    on_update({
                        "status": "waiting",
                        "message": "Waiting for accounts to be available",
                        "progress": (i / len(self.message_queue)) * 100,
                        "sent": self.sent_count,
                        "total": self.total_messages
                    })
                
                # Wait 30 seconds and try again
                await asyncio.sleep(30)
                account = self.get_available_account()
                
                if not account:
                    # Still no accounts available, log error and continue
                    error = "No accounts available for sending"
                    self.errors.append({
                        "message_index": i,
                        "error": error,
                        "time": datetime.datetime.now().isoformat()
                    })
                    
                    item["error"] = error
                    
                    if on_update:
                        on_update({
                            "status": "error",
                            "error": error,
                            "progress": (i / len(self.message_queue)) * 100,
                            "sent": self.sent_count,
                            "total": self.total_messages
                        })
                        
                    if not self.continue_on_errors:
                        break
                    else:
                        continue
            
            # We have an account, send the message
            item["account_id"] = account["id"]
            
            # Get account session path
            session_path = None
            if account["id"] in self.account_metas:
                session_path = self.account_metas[account["id"]].get("session_path")
                
            if not session_path:
                error = f"No session file found for account {account['id']}"
                self.errors.append({
                    "message_index": i,
                    "error": error,
                    "time": datetime.datetime.now().isoformat()
                })
                
                item["error"] = error
                
                if on_update:
                    on_update({
                        "status": "error",
                        "error": error,
                        "progress": (i / len(self.message_queue)) * 100,
                        "sent": self.sent_count,
                        "total": self.total_messages
                    })
                    
                if not self.continue_on_errors:
                    break
                else:
                    continue
            
            # Get proxy configuration
            proxy_config = None
            if account.get("proxy_id") in self.proxy_configs:
                proxy_config = self.proxy_configs[account["proxy_id"]]
                
            # Get group ID
            group = item["group"]
            group_id = group.get("username", group.get("telegram_id"))
            
            if not group_id:
                error = f"No valid identifier found for group {group.get('id')}"
                self.errors.append({
                    "message_index": i,
                    "error": error,
                    "time": datetime.datetime.now().isoformat()
                })
                
                item["error"] = error
                
                if on_update:
                    on_update({
                        "status": "error",
                        "error": error,
                        "progress": (i / len(self.message_queue)) * 100,
                        "sent": self.sent_count,
                        "total": self.total_messages
                    })
                    
                if not self.continue_on_errors:
                    break
                else:
                    continue
            
            # Prepare message
            message = item["message"]
            message_text = message.get("text", "")
            image_paths = message.get("image_paths", [])
            
            # Perform replacements
            message_text = message_text.replace("{name}", account.get("name", ""))
            message_text = message_text.replace("{username}", account.get("username", ""))
            message_text = message_text.replace("{group}", group.get("title", ""))
            message_text = message_text.replace("{date}", datetime.datetime.now().strftime("%Y-%m-%d"))
            message_text = message_text.replace("{time}", datetime.datetime.now().strftime("%H:%M:%S"))
            
            # Update status
            if on_update:
                on_update({
                    "status": "sending",
                    "message": f"Sending message to {group.get('title')} using {account.get('name')}",
                    "progress": (i / len(self.message_queue)) * 100,
                    "sent": self.sent_count,
                    "total": self.total_messages
                })
            
            # Send the message
            try:
                result = await send_message_async(
                    session_path=session_path,
                    group_id=group_id,
                    message_text=message_text,
                    image_paths=image_paths,
                    proxy_config=proxy_config
                )
                
                if result["success"]:
                    # Message sent successfully
                    item["sent"] = True
                    self.sent_count += 1
                    
                    # Update account usage
                    self.account_usage[account["id"]]["messages_sent"] += 1
                    self.account_usage[account["id"]]["last_used"] = datetime.datetime.now().isoformat()
                    
                    if on_update:
                        on_update({
                            "status": "success",
                            "message": f"Message sent successfully to {group.get('title')}",
                            "progress": ((i + 1) / len(self.message_queue)) * 100,
                            "sent": self.sent_count,
                            "total": self.total_messages
                        })
                else:
                    # Message sending failed
                    error = result.get("error", "Unknown error")
                    self.errors.append({
                        "message_index": i,
                        "error": error,
                        "time": datetime.datetime.now().isoformat()
                    })
                    
                    item["error"] = error
                    
                    # Check if account is on cooldown
                    if "cooldown_until" in result:
                        self.account_usage[account["id"]]["cooldown_until"] = result["cooldown_until"]
                    
                    if on_update:
                        on_update({
                            "status": "error",
                            "error": error,
                            "progress": ((i + 1) / len(self.message_queue)) * 100,
                            "sent": self.sent_count,
                            "total": self.total_messages
                        })
                        
                    if not self.continue_on_errors:
                        break
            except Exception as e:
                # Unexpected error
                error = f"Unexpected error: {str(e)}"
                self.errors.append({
                    "message_index": i,
                    "error": error,
                    "time": datetime.datetime.now().isoformat()
                })
                
                item["error"] = error
                
                if on_update:
                    on_update({
                        "status": "error",
                        "error": error,
                        "progress": ((i + 1) / len(self.message_queue)) * 100,
                        "sent": self.sent_count,
                        "total": self.total_messages
                    })
                    
                if not self.continue_on_errors:
                    break
            
            # Wait for the next message
            if i < len(self.message_queue) - 1:
                interval = random.randint(self.interval_min, self.interval_max)
                
                if on_update:
                    on_update({
                        "status": "waiting",
                        "message": f"Waiting {interval} seconds before next message",
                        "progress": ((i + 1) / len(self.message_queue)) * 100,
                        "sent": self.sent_count,
                        "total": self.total_messages
                    })
                
                await asyncio.sleep(interval)
        
        # Broadcast finished
        self.end_time = datetime.datetime.now()
        self.is_running = False
        
        # Calculate statistics
        duration = (self.end_time - self.start_time).total_seconds()
        
        result = {
            "success": True,
            "sent": self.sent_count,
            "total": self.total_messages,
            "errors": len(self.errors),
            "error_details": self.errors,
            "duration_seconds": duration,
            "average_message_time": duration / max(self.sent_count, 1)
        }
        
        if on_update:
            on_update({
                "status": "complete",
                "message": "Broadcast completed",
                "progress": 100,
                "sent": self.sent_count,
                "total": self.total_messages,
                "result": result
            })
            
        return result
    
    def pause(self):
        """Pause the broadcast"""
        self.is_paused = True
        
    def resume(self):
        """Resume the broadcast"""
        self.is_paused = False
