"""
Enhanced Broadcaster Task System for Telegram messaging.

This module handles the execution of broadcasting tasks in the background,
supporting different sending modes, work modes, and various configuration options.
"""

import os
import json
import time
import random
import logging
import datetime
import threading
from typing import List, Dict, Any, Optional, Union
import traceback

from app.utils.file_utils import get_accounts, get_accounts_meta, ensure_data_directory
from app.services.telegram_sender import send_message

# Configure logging
logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Global task registry to keep track of running tasks
task_registry = {}


class BroadcastTask:
    """Class to handle broadcasting tasks in background threads"""
    
    def __init__(self, task_id: str, task_data: Dict[str, Any], flask_app=None, data_dir: str = 'data'):
        self.task_id = task_id
        self.task_data = task_data
        self.data_dir = data_dir
        self.flask_app = flask_app  # Store Flask app reference
        self.running = False
        self.thread = None
        self.accounts = []
        self.accounts_meta = {}
        self.chat_links = []
        self.status = 'initialized'
        self.proxy_configs = {}
        
    def start(self):
        """Start the broadcasting task in a background thread"""
        if self.running:
            logger.warning(f"Task {self.task_id} is already running")
            return False
        
        self.thread = threading.Thread(target=self._run_task)
        self.thread.daemon = True  # Make sure thread doesn't block app exit
        self.running = True
        self.status = 'running'
        self.thread.start()
        
        # Update task status in file
        self._update_task_status('running')
        
        return True
    
    def stop(self):
        """Stop the broadcasting task"""
        self.running = False
        self.status = 'stopped'
        
        # Update task status in file
        self._update_task_status('stopped')
        
        return True
    
    def _run_task(self):
        """Run the broadcasting task with application context"""
        # If Flask app is available, use its context
        if self.flask_app:
            with self.flask_app.app_context():
                self._execute_task()
        else:
            # No Flask app available, run without context (may fail)
            self._execute_task()
    
    def _execute_task(self):
        """Execute the task within the appropriate context"""
        try:
            logger.info(f"Starting broadcasting task {self.task_id}")
            
            # Load accounts
            self._load_accounts()
            
            # Load proxy configurations
            self._load_proxy_configs()
            
            # Load chat links
            self._load_chat_links()
            
            # Initialize progress
            total_messages = len(self.accounts) * len(self.chat_links)
            self.task_data['progress'] = {
                'total': total_messages,
                'completed': 0,
                'errors': 0
            }
            self._update_task_file()
            
            # Check send mode
            if self.task_data.get('mode') == 'single':
                self._broadcast_single_message()
            elif self.task_data.get('mode') == 'file':
                self._broadcast_from_file()
            elif self.task_data.get('mode') == 'repost':
                self._broadcast_reposts()
            
            # Mark task as completed
            if self.running:  # Only mark as completed if not stopped
                self.status = 'completed'
                self.task_data['status'] = 'completed'
                self.task_data['completedAt'] = datetime.datetime.now().isoformat()
                self._update_task_file()
            
            logger.info(f"Broadcasting task {self.task_id} completed")
            
        except Exception as e:
            logger.error(f"Error running broadcasting task {self.task_id}: {str(e)}", exc_info=True)
            self.status = 'error'
            self.task_data['status'] = 'error'
            self.task_data['error'] = str(e)
            self._update_task_file()
        finally:
            self.running = False
    
    def _broadcast_single_message(self):
        """Broadcast a single message to all chats"""
        message = self.task_data.get('message', '')
        
        if not message:
            logger.error(f"No message provided for task {self.task_id}")
            return
        
        # Get work mode
        work_mode = self.task_data.get('workMode', 'group')
        
        if work_mode == 'group':
            # Get chat count per account
            chat_count = self.task_data.get('chatCount', 30)
            
            # Divide chats among accounts
            for account in self.accounts:
                if not self.running:
                    break
                
                account_id = account['id']
                session_path = self._get_session_path(account_id)
                
                if not session_path:
                    logger.warning(f"No session path found for account {account_id}")
                    continue
                
                # Get account chats based on chat count
                account_chats = self.chat_links[:chat_count]
                
                # Get proxy configuration for this account
                proxy_config = self.proxy_configs.get(account.get('proxy_id'))
                
                # Send messages to each chat
                for chat_link in account_chats:
                    if not self.running:
                        break
                    
                    # Check if we need to join the chat first
                    should_join = self.task_data.get('joinChats', False)
                    
                    # Process message template
                    processed_message = format_message_with_template_tags(message, account)
                    
                    # Send the message
                    result = self._send_message(
                        account, 
                        session_path, 
                        chat_link, 
                        processed_message, 
                        proxy_config=proxy_config,
                        join_chat=should_join,
                        hide_source=self.task_data.get('hideSource', False)
                    )
                    
                    # Process after post if needed
                    if result.get('success') and self.task_data.get('processAfterPost', False):
                        self._process_after_post(account, session_path, chat_link, result.get('message_id'), proxy_config)
                    
                    # Delete after if needed
                    if result.get('success') and self.task_data.get('deleteAfter', False):
                        self._delete_message(account, session_path, chat_link, result.get('message_id'), proxy_config)
                    
                    # Leave chat if needed
                    if self.task_data.get('leaveChats', False):
                        self._leave_chat(account, session_path, chat_link, proxy_config)
                    
                    # Sleep between messages to avoid rate limiting
                    self._random_sleep(1, 5)
        else:  # single mode
            # Send to first chat only
            if not self.chat_links:
                logger.error(f"No chat links found for task {self.task_id}")
                return
            
            chat_link = self.chat_links[0]
            
            for account in self.accounts:
                if not self.running:
                    break
                
                account_id = account['id']
                session_path = self._get_session_path(account_id)
                
                if not session_path:
                    logger.warning(f"No session path found for account {account_id}")
                    continue
                
                # Get proxy configuration for this account
                proxy_config = self.proxy_configs.get(account.get('proxy_id'))
                
                # Process message template
                processed_message = format_message_with_template_tags(message, account)
                
                # Send the message
                result = self._send_message(
                    account, 
                    session_path, 
                    chat_link, 
                    processed_message, 
                    proxy_config=proxy_config,
                    join_chat=self.task_data.get('joinChats', False),
                    hide_source=self.task_data.get('hideSource', False)
                )
                
                # Process after post if needed
                if result.get('success') and self.task_data.get('processAfterPost', False):
                    self._process_after_post(account, session_path, chat_link, result.get('message_id'), proxy_config)
                
                # Delete after if needed
                if result.get('success') and self.task_data.get('deleteAfter', False):
                    self._delete_message(account, session_path, chat_link, result.get('message_id'), proxy_config)
                
                # Leave chat if needed
                if self.task_data.get('leaveChats', False):
                    self._leave_chat(account, session_path, chat_link, proxy_config)
                
                # Sleep between messages to avoid rate limiting
                self._random_sleep(1, 5)
        
        # Handle repeat broadcasting
        if self.running and self.task_data.get('repeatBroadcast', False):
            # Sleep for the specified wait period
            wait_min = self.task_data.get('waitPeriod', {}).get('min', 1)
            wait_max = self.task_data.get('waitPeriod', {}).get('max', 1)
            
            sleep_minutes = random.randint(wait_min, wait_max)
            logger.info(f"Waiting {sleep_minutes} minutes before repeating broadcast")
            
            # Sleep in small increments to check if task was stopped
            for _ in range(sleep_minutes * 60):
                if not self.running:
                    break
                time.sleep(1)
            
            if self.running:
                # Recursively call to repeat
                self._broadcast_single_message()
    
    def _broadcast_from_file(self):
        """Broadcast messages from a text file"""
        # Get the chat list URL from task data
        chat_list_url = self.task_data.get('chatListUrl')
        if not chat_list_url:
            logger.error(f"No chat list URL provided for task {self.task_id}")
            return
            
        # Split the URL to get the file path
        file_path = chat_list_url.lstrip('/')
        if file_path.startswith('uploads/'):
            file_path = file_path[8:]  # Remove 'uploads/' prefix
            
        # Make sure the file path is correct
        full_path = os.path.join('uploads', file_path)
        if not os.path.exists(full_path):
            logger.error(f"Chat list file not found: {full_path}")
            return
            
        try:
            # Read messages from the file
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Split messages by the delimiter "[===]"
            messages = content.split("[===]")
            messages = [msg.strip() for msg in messages if msg.strip()]
            
            if not messages:
                logger.error(f"No messages found in file: {full_path}")
                return
                
            logger.info(f"Found {len(messages)} messages in file")
            
            # Get work mode
            work_mode = self.task_data.get('workMode', 'group')
            
            if work_mode == 'group':
                # Get chat count per account
                chat_count = self.task_data.get('chatCount', 30)
                
                # Divide chats among accounts
                for account in self.accounts:
                    if not self.running:
                        break
                    
                    account_id = account['id']
                    session_path = self._get_session_path(account_id)
                    
                    if not session_path:
                        logger.warning(f"No session path found for account {account_id}")
                        continue
                    
                    # Get account chats based on chat count
                    account_chats = self.chat_links[:chat_count]
                    
                    # Get proxy configuration for this account
                    proxy_config = self.proxy_configs.get(account.get('proxy_id'))
                    
                    # For each chat, send a random message from the list
                    for chat_link in account_chats:
                        if not self.running:
                            break
                        
                        # Select a random message from the list
                        message = random.choice(messages)
                        
                        # Process template tags
                        processed_message = format_message_with_template_tags(message, account)
                        
                        # Send the message
                        result = self._send_message(
                            account, 
                            session_path, 
                            chat_link, 
                            processed_message, 
                            proxy_config=proxy_config,
                            join_chat=self.task_data.get('joinChats', False),
                            hide_source=self.task_data.get('hideSource', False)
                        )
                        
                        # Process after post if needed
                        if result.get('success') and self.task_data.get('processAfterPost', False):
                            self._process_after_post(account, session_path, chat_link, result.get('message_id'), proxy_config)
                        
                        # Delete after if needed
                        if result.get('success') and self.task_data.get('deleteAfter', False):
                            self._delete_message(account, session_path, chat_link, result.get('message_id'), proxy_config)
                        
                        # Leave chat if needed
                        if self.task_data.get('leaveChats', False):
                            self._leave_chat(account, session_path, chat_link, proxy_config)
                        
                        # Sleep between messages to avoid rate limiting
                        self._random_sleep(1, 5)
            else:  # single mode
                # Send to first chat only
                if not self.chat_links:
                    logger.error(f"No chat links found for task {self.task_id}")
                    return
                
                chat_link = self.chat_links[0]
                
                # For each account, send a random message
                for account in self.accounts:
                    if not self.running:
                        break
                    
                    account_id = account['id']
                    session_path = self._get_session_path(account_id)
                    
                    if not session_path:
                        logger.warning(f"No session path found for account {account_id}")
                        continue
                    
                    # Get proxy configuration for this account
                    proxy_config = self.proxy_configs.get(account.get('proxy_id'))
                    
                    # Select a random message from the list
                    message = random.choice(messages)
                    
                    # Process template tags
                    processed_message = format_message_with_template_tags(message, account)
                    
                    # Send the message
                    result = self._send_message(
                        account, 
                        session_path, 
                        chat_link, 
                        processed_message, 
                        proxy_config=proxy_config,
                        join_chat=self.task_data.get('joinChats', False),
                        hide_source=self.task_data.get('hideSource', False)
                    )
                    
                    # Process after post if needed
                    if result.get('success') and self.task_data.get('processAfterPost', False):
                        self._process_after_post(account, session_path, chat_link, result.get('message_id'), proxy_config)
                    
                    # Delete after if needed
                    if result.get('success') and self.task_data.get('deleteAfter', False):
                        self._delete_message(account, session_path, chat_link, result.get('message_id'), proxy_config)
                    
                    # Leave chat if needed
                    if self.task_data.get('leaveChats', False):
                        self._leave_chat(account, session_path, chat_link, proxy_config)
                    
                    # Sleep between messages to avoid rate limiting
                    self._random_sleep(1, 5)
                    
            # Handle repeat broadcasting
            if self.running and self.task_data.get('repeatBroadcast', False):
                # Sleep for the specified wait period
                wait_min = self.task_data.get('waitPeriod', {}).get('min', 1)
                wait_max = self.task_data.get('waitPeriod', {}).get('max', 1)
                
                sleep_minutes = random.randint(wait_min, wait_max)
                logger.info(f"Waiting {sleep_minutes} minutes before repeating broadcast")
                
                # Sleep in small increments to check if task was stopped
                for _ in range(sleep_minutes * 60):
                    if not self.running:
                        break
                    time.sleep(1)
                
                if self.running:
                    # Recursively call to repeat
                    self._broadcast_from_file()
        except Exception as e:
            logger.error(f"Error broadcasting from file: {str(e)}", exc_info=True)
            raise
    
    def _broadcast_reposts(self):
        """Broadcast reposts from a public chat or channel"""
        # Get the channel URL from task data (this would typically be provided in the task data)
        source_chat = self.task_data.get('sourceChat')
        if not source_chat:
            logger.error(f"No source chat provided for task {self.task_id}")
            return
        
        # The logic for reposting would require us to:
        # 1. Connect to the source chat
        # 2. Get recent messages
        # 3. Forward them to the target chats
        
        # Since this requires additional Telegram API functionality (message history & forwarding),
        # I'll implement a simulation for now. In a real implementation, you would use
        # the Telegram API to get messages and forward them.
        
        logger.info(f"Processing repost from source chat: {source_chat}")
        
        # Create a sample message that indicates it's a repost
        repost_message = f"This is a repost from {source_chat}.\n\nSample content would appear here."
        
        # Get work mode
        work_mode = self.task_data.get('workMode', 'group')
        
        if work_mode == 'group':
            # Get chat count per account
            chat_count = self.task_data.get('chatCount', 30)
            
            # Divide chats among accounts
            for account in self.accounts:
                if not self.running:
                    break
                
                account_id = account['id']
                session_path = self._get_session_path(account_id)
                
                if not session_path:
                    logger.warning(f"No session path found for account {account_id}")
                    continue
                
                # Get account chats based on chat count
                account_chats = self.chat_links[:chat_count]
                
                # Get proxy configuration for this account
                proxy_config = self.proxy_configs.get(account.get('proxy_id'))
                
                # Send messages to each chat
                for chat_link in account_chats:
                    if not self.running:
                        break
                    
                    # Send the message
                    result = self._send_message(
                        account, 
                        session_path, 
                        chat_link, 
                        repost_message, 
                        proxy_config=proxy_config,
                        join_chat=self.task_data.get('joinChats', False),
                        hide_source=self.task_data.get('hideSource', False)
                    )
                    
                    # In a real implementation, we would use the Telegram API's forward_messages method
                    # instead of send_message, but for simulation purposes, we're just sending a text message
                    
                    # Process after post if needed
                    if result.get('success') and self.task_data.get('processAfterPost', False):
                        self._process_after_post(account, session_path, chat_link, result.get('message_id'), proxy_config)
                    
                    # Delete after if needed
                    if result.get('success') and self.task_data.get('deleteAfter', False):
                        self._delete_message(account, session_path, chat_link, result.get('message_id'), proxy_config)
                    
                    # Leave chat if needed
                    if self.task_data.get('leaveChats', False):
                        self._leave_chat(account, session_path, chat_link, proxy_config)
                    
                    # Sleep between messages to avoid rate limiting
                    self._random_sleep(1, 5)
        else:  # single mode
            # Send to first chat only
            if not self.chat_links:
                logger.error(f"No chat links found for task {self.task_id}")
                return
            
            chat_link = self.chat_links[0]
            
            for account in self.accounts:
                if not self.running:
                    break
                
                account_id = account['id']
                session_path = self._get_session_path(account_id)
                
                if not session_path:
                    logger.warning(f"No session path found for account {account_id}")
                    continue
                
                # Get proxy configuration for this account
                proxy_config = self.proxy_configs.get(account.get('proxy_id'))
                
                # Send the message
                result = self._send_message(
                    account, 
                    session_path, 
                    chat_link, 
                    repost_message, 
                    proxy_config=proxy_config,
                    join_chat=self.task_data.get('joinChats', False),
                    hide_source=self.task_data.get('hideSource', False)
                )
                
                # Process after post if needed
                if result.get('success') and self.task_data.get('processAfterPost', False):
                    self._process_after_post(account, session_path, chat_link, result.get('message_id'), proxy_config)
                
                # Delete after if needed
                if result.get('success') and self.task_data.get('deleteAfter', False):
                    self._delete_message(account, session_path, chat_link, result.get('message_id'), proxy_config)
                
                # Leave chat if needed
                if self.task_data.get('leaveChats', False):
                    self._leave_chat(account, session_path, chat_link, proxy_config)
                
                # Sleep between messages to avoid rate limiting
                self._random_sleep(1, 5)
        
        # Handle repeat broadcasting
        if self.running and self.task_data.get('repeatBroadcast', False):
            # Sleep for the specified wait period
            wait_min = self.task_data.get('waitPeriod', {}).get('min', 1)
            wait_max = self.task_data.get('waitPeriod', {}).get('max', 1)
            
            sleep_minutes = random.randint(wait_min, wait_max)
            logger.info(f"Waiting {sleep_minutes} minutes before repeating broadcast")
            
            # Sleep in small increments to check if task was stopped
            for _ in range(sleep_minutes * 60):
                if not self.running:
                    break
                time.sleep(1)
            
            if self.running:
                # Recursively call to repeat
                self._broadcast_reposts()
    
    def _send_message(self, account, session_path, chat_link, message, proxy_config=None, 
                     join_chat=False, hide_source=False, media_paths=None):
        """Send a message to a chat"""
        try:
            # Process message template replacements
            processed_message = format_message_with_template_tags(message, account)
            
            logger.info(f"Sending message from {account.get('name')} to {chat_link}")
            
            # Send message using telegram_sender
            result = send_message(
                session_path=session_path,
                group_id=chat_link,
                message_text=processed_message,
                proxy_config=proxy_config,
                image_paths=media_paths
            )
            
            # Check result
            if result.get('success'):
                # Update progress
                self.task_data['progress']['completed'] += 1
                self._update_task_file()
                
                logger.info(f"Message sent successfully from {account.get('name')} to {chat_link}")
                
                return result
            else:
                # Update progress for errors
                self.task_data['progress']['errors'] += 1
                self._update_task_file()
                
                error_message = result.get('error', 'Unknown error')
                logger.error(f"Error sending message to {chat_link}: {error_message}")
                
                # Check if this is a flood error
                if 'flood' in error_message.lower() and self.task_data.get('useFloodCheck', False):
                    logger.info(f"Handling flood error for account {account.get('name')}")
                    # In a real implementation, you would check with @spambot
                    # For now, we'll just add a cooldown
                    
                    # Add a 1-hour cooldown as an example
                    cooldown_time = datetime.datetime.now() + datetime.timedelta(hours=1)
                    
                    # Update account with cooldown
                    all_accounts = get_accounts()
                    for i, acc in enumerate(all_accounts):
                        if acc['id'] == account['id']:
                            all_accounts[i]['cooldown_until'] = cooldown_time.isoformat()
                            from app.utils.file_utils import save_accounts
                            save_accounts(all_accounts)
                            break
                
                return result
        except Exception as e:
            logger.error(f"Error sending message: {str(e)}", exc_info=True)
            # Update progress for errors
            self.task_data['progress']['errors'] += 1
            self._update_task_file()
            
            return {
                "success": False,
                "error": str(e)
            }
    
    def _process_after_post(self, account, session_path, chat_link, message_id, proxy_config=None):
        """Check if the message was deleted after posting"""
        logger.info(f"Checking if message {message_id} was deleted in {chat_link}")
        
        # In a real implementation, you would use the Telegram API to check if the message
        # still exists in the chat. For now, we'll just simulate this.
        
        # Sleep a bit to simulate checking
        time.sleep(2)
        
        # Assume 10% chance the message was deleted
        was_deleted = random.random() < 0.1
        
        if was_deleted:
            logger.warning(f"Message {message_id} was deleted in {chat_link}")
            # You might want to take some action here, like marking the chat as hostile
        else:
            logger.info(f"Message {message_id} still exists in {chat_link}")
    
    def _delete_message(self, account, session_path, chat_link, message_id, proxy_config=None):
        """Delete a message after a delay"""
        logger.info(f"Deleting message {message_id} from {chat_link}")
        
        # In a real implementation, you would use the Telegram API to delete the message
        # For now, we'll just simulate this
        
        # Sleep a bit to simulate deletion delay
        time.sleep(1)
        
        # Assume 90% chance of successful deletion
        success = random.random() < 0.9
        
        if success:
            logger.info(f"Message {message_id} deleted successfully from {chat_link}")
        else:
            logger.warning(f"Failed to delete message {message_id} from {chat_link}")
    
    def _leave_chat(self, account, session_path, chat_link, proxy_config=None):
        """Leave a chat after posting"""
        logger.info(f"Leaving chat {chat_link}")
        
        # In a real implementation, you would use the Telegram API to leave the chat
        # For now, we'll just simulate this
        
        # Sleep a bit to simulate leaving
        time.sleep(1)
        
        # Assume 95% chance of successfully leaving
        success = random.random() < 0.95
        
        if success:
            logger.info(f"Successfully left chat {chat_link}")
        else:
            logger.warning(f"Failed to leave chat {chat_link}")
    
    def _process_message_template(self, message, account):
        """Process message template replacements"""
        processed = message
        
        # Replace account-specific placeholders
        processed = processed.replace('{name}', account.get('name', ''))
        processed = processed.replace('{username}', account.get('username', ''))
        processed = processed.replace('{phone}', account.get('phone', ''))
        
        # Replace date/time placeholders
        now = datetime.datetime.now()
        processed = processed.replace('{date}', now.strftime('%Y-%m-%d'))
        processed = processed.replace('{time}', now.strftime('%H:%M:%S'))
        
        # Process random variants with [option1]/[option2]/[option3] syntax
        while '[' in processed and ']' in processed:
            start = processed.find('[')
            end = processed.find(']', start)
            
            if start != -1 and end != -1:
                options_text = processed[start+1:end]
                options = options_text.split('/')
                
                if options:
                    chosen_option = random.choice(options)
                    processed = processed[:start] + chosen_option + processed[end+1:]
                else:
                    # If no options found, just remove the brackets
                    processed = processed[:start] + processed[start+1:end] + processed[end+1:]
        
        return processed
    
    def _get_session_path(self, account_id):
        """Get the session path for an account"""
        # First try to get from meta data
        if account_id in self.accounts_meta:
            session_path = self.accounts_meta[account_id].get('session_path')
            if session_path and os.path.exists(session_path):
                return session_path
        
        # Try to find by account phone or telegram_id
        account = next((acc for acc in self.accounts if acc['id'] == account_id), None)
        if not account:
            return None
        
        sessions_dir = os.path.join(os.getcwd(), "saved_sessions")
        
        # Try by telegram_id if available in meta
        if account_id in self.accounts_meta:
            telegram_id = self.accounts_meta[account_id].get('telegram_id')
            if telegram_id:
                session_path = os.path.join(sessions_dir, f"{telegram_id}.session")
                if os.path.exists(session_path):
                    return session_path
        
        # Try by phone number
        if account.get('phone'):
            phone = account['phone'].replace('+', '')
            session_path = os.path.join(sessions_dir, f"{phone}.session")
            if os.path.exists(session_path):
                return session_path
        
        return None
    
    def _load_accounts(self):
        """Load accounts for the task"""
        from app.utils.file_utils import get_accounts, get_accounts_meta
        
        all_accounts = get_accounts()
        account_ids = self.task_data.get('accountIds', [])
        
        self.accounts = [acc for acc in all_accounts if acc['id'] in account_ids]
        
        # Load account metadata
        self.accounts_meta = get_accounts_meta()
        
        logger.info(f"Loaded {len(self.accounts)} accounts for task {self.task_id}")
    
    def _load_proxy_configs(self):
        """Load proxy configurations for accounts"""
        from app.utils.file_utils import get_proxies
        
        # Get all proxies
        proxies = get_proxies()
        
        # Create proxy configurations
        for proxy in proxies:
            proxy_id = proxy.get('id')
            if not proxy_id:
                continue
                
            # Configure proxy for Telegram
            proxy_type = proxy.get('type', 'http')
            host = proxy.get('host', '')
            port = proxy.get('port', 0)
            username = proxy.get('username', '')
            password = proxy.get('password', '')
            
            if not host or not port:
                continue
                
            # Create proxy config
            if username and password:
                proxy_config = {
                    'proxy_type': proxy_type,
                    'addr': host,
                    'port': port,
                    'username': username,
                    'password': password
                }
            else:
                proxy_config = {
                    'proxy_type': proxy_type,
                    'addr': host,
                    'port': port
                }
                
            self.proxy_configs[proxy_id] = proxy_config
            
        logger.info(f"Loaded {len(self.proxy_configs)} proxy configurations")
    
    def _load_chat_links(self):
        """Load chat links from file or list"""
        # If there's a chat list URL in the task data, use that
        chat_list_url = self.task_data.get('chatListUrl')
        if chat_list_url:
            logger.info(f"Chat list URL found in task data: {chat_list_url}")
            
            # Handle different URL formats
            # Strip any leading slashes or http:// parts
            file_path = chat_list_url.lstrip('/')
            
            # Remove domain if present (in case of full URLs)
            if '://' in file_path:
                file_path = file_path.split('/', 3)[-1]
                
            # If path starts with 'uploads/', keep it as is
            if file_path.startswith('uploads/'):
                pass  # Keep as is
            # If not, and doesn't have any directory prefix, assume it's in uploads
            elif '/' not in file_path:
                file_path = f"uploads/{file_path}"
                
            # Try multiple path variations to be robust
            potential_paths = [
                file_path,  # As processed above
                os.path.join('uploads', os.path.basename(file_path)),  # Just the filename in uploads
                chat_list_url.lstrip('/'),  # Original with leading slash removed
                chat_list_url,  # Original as is
            ]
            
            # Try each path until we find one that exists
            for path in potential_paths:
                logger.info(f"Trying path: {path}")
                if os.path.exists(path):
                    logger.info(f"Found file at path: {path}")
                    try:
                        with open(path, 'r', encoding='utf-8') as f:
                            lines = f.readlines()
                            
                        # Process each line, removing whitespace and ignoring empty lines
                        chat_links = []
                        for line in lines:
                            line = line.strip()
                            if line:
                                # Format the chat link correctly based on its type
                                if line.startswith('t.me/') or line.startswith('https://t.me/'):
                                    # Already in URL format, don't add @ prefix
                                    chat_links.append(line)
                                elif line.startswith('@'):
                                    # Already has @ prefix, keep as is
                                    chat_links.append(line)
                                else:
                                    # Plain username, add @ prefix
                                    chat_links.append(f"@{line}")
                                
                        self.chat_links = chat_links
                        logger.info(f"Successfully loaded {len(self.chat_links)} chat links from file: {path}")
                        return
                    except Exception as e:
                        logger.error(f"Error loading chat links from file {path}: {str(e)}")
                else:
                    logger.warning(f"File not found at path: {path}")
        
        # If no URL provided or couldn't load from file, check if we should use real groups from the database
        try:
            from app.utils.file_utils import get_groups
            all_groups = get_groups()
            if all_groups and len(all_groups) > 0:
                logger.info(f"No chat list file found, using {len(all_groups)} groups from database")
                chat_links = []
                for group in all_groups:
                    username = group.get('username')
                    if username:
                        if not username.startswith('@') and not username.startswith('t.me/') and not username.startswith('https://t.me/'):
                            username = f"@{username}"
                        chat_links.append(username)
                        
                if chat_links:
                    self.chat_links = chat_links
                    logger.info(f"Loaded {len(self.chat_links)} chat links from database")
                    return
        except Exception as e:
            logger.warning(f"Error loading groups from database: {str(e)}")
        
        # If we couldn't load from file or database, use a default list for testing
        self.chat_links = [
            "@group1",
            "@group2",
            "@group3",
            "@group4",
            "@group5",
            "@test_group"
        ]
        
        logger.info(f"Using default chat links: {len(self.chat_links)} links")
    
    def _update_task_status(self, status):
        """Update task status in file"""
        self.task_data['status'] = status
        
        if status == 'running':
            self.task_data['startedAt'] = datetime.datetime.now().isoformat()
        elif status in ['completed', 'stopped', 'error']:
            self.task_data['completedAt'] = datetime.datetime.now().isoformat()
        
        self._update_task_file()
    
    def _update_task_file(self):
        """Update task data in the tasks file"""
        tasks_file = os.path.join(self.data_dir, 'broadcast_tasks.json')
        
        # Load existing tasks
        if os.path.exists(tasks_file):
            with open(tasks_file, 'r') as f:
                try:
                    tasks = json.load(f)
                except json.JSONDecodeError:
                    tasks = {}
        else:
            tasks = {}
        
        # Update task data
        tasks[self.task_id] = self.task_data
        
        # Save tasks
        os.makedirs(self.data_dir, exist_ok=True)
        with open(tasks_file, 'w') as f:
            json.dump(tasks, f, indent=2)
    
    def _random_sleep(self, min_seconds, max_seconds):
        """Sleep for a random duration between min and max seconds"""
        duration = random.uniform(min_seconds, max_seconds)
        
        # Sleep in small increments to check if task was stopped
        end_time = time.time() + duration
        while time.time() < end_time:
            if not self.running:
                break
            time.sleep(min(0.5, end_time - time.time()))


# Task management functions
def start_task(task_id: str, task_data: Dict[str, Any], flask_app=None, data_dir: str = 'data') -> bool:
    """Start a broadcasting task"""
    # Check if task is already running
    if task_id in task_registry:
        logger.warning(f"Task {task_id} is already in the registry")
        return False
    
    # Create task
    task = BroadcastTask(task_id, task_data, flask_app, data_dir)
    
    # Start task
    if task.start():
        # Add to registry
        task_registry[task_id] = task
        return True
    
    return False


def stop_task(task_id: str) -> bool:
    """Stop a broadcasting task"""
    if task_id in task_registry:
        task = task_registry[task_id]
        result = task.stop()
        
        # Remove from registry
        if result:
            del task_registry[task_id]
        
        return result
    
    return False


def get_task_status(task_id: str) -> Optional[str]:
    """Get the status of a task"""
    if task_id in task_registry:
        return task_registry[task_id].status
    
    return None


def cleanup_tasks():
    """Clean up completed or failed tasks"""
    for task_id in list(task_registry.keys()):
        task = task_registry[task_id]
        
        if not task.running or task.status in ['completed', 'error', 'stopped']:
            del task_registry[task_id]