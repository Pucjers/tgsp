"""
Background task handler for broadcasting messages.
This module handles the execution of broadcasting tasks in the background.
"""

import os
import json
import time
import random
import logging
import datetime
import threading
from typing import List, Dict, Any, Optional

from app.utils.file_utils import get_accounts, get_accounts_meta
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
    
    def __init__(self, task_id: str, task_data: Dict[str, Any], data_dir: str = 'data'):
        self.task_id = task_id
        self.task_data = task_data
        self.data_dir = data_dir
        self.running = False
        self.thread = None
        self.accounts = []
        self.accounts_meta = {}
        self.chat_links = []
        self.status = 'initialized'
        
    def start(self):
        """Start the broadcasting task in a background thread"""
        if self.running:
            logger.warning(f"Task {self.task_id} is already running")
            return False
        
        self.thread = threading.Thread(target=self._run_task)
        self.thread.daemon = True
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
        """Run the broadcasting task"""
        try:
            logger.info(f"Starting broadcasting task {self.task_id}")
            
            # Load accounts
            self._load_accounts()
            
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
                
                # Send messages to each chat
                for chat_link in account_chats:
                    if not self.running:
                        break
                    
                    self._send_message(account, session_path, chat_link, message)
                    
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
                
                self._send_message(account, session_path, chat_link, message)
                
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
        # Implementation would be similar to _broadcast_single_message
        # but reading multiple messages from a file
        pass
    
    def _broadcast_reposts(self):
        """Broadcast reposts from a public chat or channel"""
        # Implementation would handle reposting messages
        pass
    
    def _send_message(self, account, session_path, chat_link, message):
        """Send a message to a chat"""
        try:
            # Process message template replacements
            processed_message = self._process_message_template(message, account)
            
            logger.info(f"Sending message from {account.get('name')} to {chat_link}")
            
            # Send message using telegram_sender
            result = send_message(
                session_path=session_path,
                group_id=chat_link,
                message_text=processed_message
            )
            
            # Check result
            if result.get('success'):
                # Update progress
                self.task_data['progress']['completed'] += 1
                self._update_task_file()
                
                logger.info(f"Message sent successfully from {account.get('name')} to {chat_link}")
                
                # Check if we need to process after post
                if self.task_data.get('processAfterPost', False):
                    logger.info(f"Checking if message was deleted for {chat_link}")
                    # Implementation for checking if message was deleted would go here
                    time.sleep(2)  # Wait a bit to check
                
                # Check if we need to delete after posting
                if self.task_data.get('deleteAfter', False):
                    logger.info(f"Deleting message from {chat_link}")
                    # Implementation for deleting message would go here
                    time.sleep(1)  # Wait a bit before deleting
            else:
                # Update progress for errors
                self.task_data['progress']['errors'] += 1
                self._update_task_file()
                
                error_message = result.get('error', 'Unknown error')
                logger.error(f"Error sending message to {chat_link}: {error_message}")
                
                # Check if this is a flood error
                if 'flood' in error_message.lower() and self.task_data.get('useFloodCheck', False):
                    logger.info(f"Handling flood error for account {account.get('name')}")
                    # Implementation for flood check with @spambot would go here
        except Exception as e:
            logger.error(f"Error sending message: {str(e)}")
            # Update progress for errors
            self.task_data['progress']['errors'] += 1
            self._update_task_file()
    
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
        all_accounts = get_accounts()
        account_ids = self.task_data.get('accountIds', [])
        
        self.accounts = [acc for acc in all_accounts if acc['id'] in account_ids]
        
        # Load account metadata
        self.accounts_meta = get_accounts_meta()
        
        logger.info(f"Loaded {len(self.accounts)} accounts for task {self.task_id}")
    
    def _load_chat_links(self):
        """Load chat links from file or list"""
        # For now, we'll use a simple example list
        # In a real implementation, this would read from a file
        self.chat_links = [
            "@group1",
            "@group2",
            "@group3",
            "@group4",
            "@group5",
            "@test_group"
        ]
        
        logger.info(f"Loaded {len(self.chat_links)} chat links for task {self.task_id}")
    
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
def start_task(task_id: str, task_data: Dict[str, Any], data_dir: str = 'data') -> bool:
    """Start a broadcasting task"""
    # Check if task is already running
    if task_id in task_registry:
        logger.warning(f"Task {task_id} is already in the registry")
        return False
    
    # Create task
    task = BroadcastTask(task_id, task_data, data_dir)
    
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