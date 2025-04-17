"""
Enhanced Broadcaster API Routes for Telegram messaging.

This module provides improved API endpoints for the message broadcasting system,
with better task management, status tracking, and enhanced error handling.
"""

from flask import request, jsonify, current_app
import os
import datetime
import json
import uuid
import tempfile
from werkzeug.utils import secure_filename

from app.api.broadcaster import broadcaster_bp
from app.utils.file_utils import allowed_file, get_accounts, get_accounts_meta

# Import the broadcaster task system
from app.services.broadcaster_tasks import start_task, stop_task, get_task_status, cleanup_tasks
from app.services.message_formatter import format_message_with_template_tags

@broadcaster_bp.route('/create-task', methods=['POST'])
def create_broadcasting_task():
    """Create a new broadcasting task with enhanced validation and error handling"""
    try:
        # Get request data
        data = request.json
        
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
        
        # Validate required fields
        required_fields = ['name', 'mode', 'workMode', 'selectedAccounts']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return jsonify({
                "success": False, 
                "error": f"Missing required fields: {', '.join(missing_fields)}"
            }), 400
        
        # Validate accounts
        account_ids = data.get('selectedAccounts', [])
        if not account_ids:
            return jsonify({"success": False, "error": "No accounts selected"}), 400
        
        # Get accounts
        all_accounts = get_accounts()
        selected_accounts = [acc for acc in all_accounts if acc.get('id') in account_ids]
        
        if not selected_accounts:
            return jsonify({"success": False, "error": "None of the selected accounts were found"}), 404
        
        # Create task ID
        task_id = str(uuid.uuid4())
        
        # Create task object with improved structure
        task = {
            "id": task_id,
            "name": data.get('name'),
            "mode": data.get('mode'),
            "workMode": data.get('workMode'),
            "message": data.get('message', ''),
            "chatCount": data.get('chatCount', 6),
            "waitPeriod": data.get('waitPeriod', {"min": 1, "max": 1}),
            "hideSource": data.get('hideSource', False),
            "repeatBroadcast": data.get('repeatBroadcast', False),
            "joinChats": data.get('joinChats', False),
            "processAfterPost": data.get('processAfterPost', False),
            "deleteAfter": data.get('deleteAfter', False),
            "leaveChats": data.get('leaveChats', False),
            "useFloodCheck": data.get('useFloodCheck', False),
            "accountIds": account_ids,
            "status": "created",
            "createdAt": datetime.datetime.now().isoformat(),
            "startedAt": None,
            "completedAt": None,
            "progress": {
                "total": 0,
                "completed": 0,
                "errors": 0
            },
            "error": None
        }
        
        # If a chat list file was uploaded, store its URL
        if 'chatListUrl' in data and data['chatListUrl']:
            task['chatListUrl'] = data['chatListUrl']
        
        # For repost mode, store the source chat
        if data.get('mode') == 'repost' and 'sourceChat' in data:
            task['sourceChat'] = data['sourceChat']
        
        # Save task to JSON file
        data_dir = current_app.config.get('DATA_DIR', 'data')
        tasks_file = os.path.join(data_dir, 'broadcast_tasks.json')
        
        # Create tasks list or load existing tasks
        if os.path.exists(tasks_file):
            with open(tasks_file, 'r') as f:
                try:
                    tasks = json.load(f)
                except json.JSONDecodeError:
                    tasks = {}
        else:
            tasks = {}
        
        # Add task to tasks list
        tasks[task_id] = task
        
        # Save tasks
        os.makedirs(data_dir, exist_ok=True)
        with open(tasks_file, 'w') as f:
            json.dump(tasks, f, indent=2)
        
        # Check if auto-run is requested
        auto_run = data.get('auto_run', False)
        if auto_run:
            # Start the task in the background
            # Pass current_app for Flask context
            success = start_task(task_id, task, current_app._get_current_object(), data_dir)
            
            if success:
                current_app.logger.info(f"Task {task_id} started successfully")
            else:
                current_app.logger.error(f"Failed to start task {task_id}")
                return jsonify({"success": False, "error": "Failed to start task"}), 500
            
        return jsonify({
            "success": True,
            "task_id": task_id,
            "auto_run": auto_run
        })
    
    except Exception as e:
        current_app.logger.error(f"Error creating broadcasting task: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"Error creating task: {str(e)}"
        }), 500


@broadcaster_bp.route('/tasks', methods=['GET'])
def get_broadcasting_tasks():
    """Get all broadcasting tasks with enhanced error handling"""
    try:
        task_id = request.args.get('task_id')
        data_dir = current_app.config.get('DATA_DIR', 'data')
        tasks_file = os.path.join(data_dir, 'broadcast_tasks.json')
        
        # Check if tasks file exists
        if not os.path.exists(tasks_file):
            if task_id:
                return jsonify({"success": False, "error": "Task not found"}), 404
            return jsonify({"success": True, "tasks": {}})
        
        # Load tasks
        with open(tasks_file, 'r') as f:
            try:
                tasks = json.load(f)
            except json.JSONDecodeError:
                current_app.logger.error("Invalid JSON in tasks file")
                tasks = {}
        
        # Clean up completed tasks from registry to avoid memory leaks
        cleanup_tasks()
        
        # Return specific task or all tasks
        if task_id:
            if task_id in tasks:
                # Update status from registry if task is running
                status = get_task_status(task_id)
                if status:
                    tasks[task_id]['status'] = status
                
                return jsonify({
                    "success": True,
                    "task": tasks[task_id]
                })
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # For all tasks, update their statuses from the registry if running
        running_tasks = []
        for task_id in list(tasks.keys()):
            status = get_task_status(task_id)
            if status:
                tasks[task_id]['status'] = status
                running_tasks.append(task_id)
                
        current_app.logger.info(f"Found {len(running_tasks)} running tasks out of {len(tasks)} total")
        
        return jsonify({
            "success": True,
            "tasks": tasks
        })
    
    except Exception as e:
        current_app.logger.error(f"Error getting broadcasting tasks: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"Error getting tasks: {str(e)}"
        }), 500


@broadcaster_bp.route('/tasks/<task_id>', methods=['DELETE'])
def delete_broadcasting_task(task_id):
    """Delete a broadcasting task with improved error handling"""
    try:
        data_dir = current_app.config.get('DATA_DIR', 'data')
        tasks_file = os.path.join(data_dir, 'broadcast_tasks.json')
        
        # Check if tasks file exists
        if not os.path.exists(tasks_file):
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Load tasks
        with open(tasks_file, 'r') as f:
            try:
                tasks = json.load(f)
            except json.JSONDecodeError:
                return jsonify({"success": False, "error": "Invalid tasks file"}), 500
        
        # Check if task exists
        if task_id not in tasks:
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Check if task is running
        status = get_task_status(task_id)
        if status == 'running':
            # Stop the task first
            stop_result = stop_task(task_id)
            if not stop_result:
                current_app.logger.warning(f"Failed to stop task {task_id} before deletion")
        
        # Delete task from the registry
        # This should be done even if stopping failed, to avoid ghost tasks
        try:
            stop_task(task_id)
        except Exception as e:
            current_app.logger.warning(f"Exception while cleaning up task {task_id}: {e}")
        
        # Get task info for logging
        task_name = tasks[task_id].get('name', 'Unknown')
        task_status = tasks[task_id].get('status', 'Unknown')
        
        # Delete task from tasks file
        del tasks[task_id]
        
        # Save tasks
        with open(tasks_file, 'w') as f:
            json.dump(tasks, f, indent=2)
        
        current_app.logger.info(f"Deleted task {task_id} ({task_name}) with status {task_status}")
        
        return jsonify({
            "success": True,
            "message": "Task deleted successfully"
        })
    
    except Exception as e:
        current_app.logger.error(f"Error deleting broadcasting task: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"Error deleting task: {str(e)}"
        }), 500


@broadcaster_bp.route('/tasks/<task_id>/start', methods=['POST'])
def start_broadcasting_task(task_id):
    """Start a broadcasting task with improved error handling"""
    try:
        data_dir = current_app.config.get('DATA_DIR', 'data')
        tasks_file = os.path.join(data_dir, 'broadcast_tasks.json')
        
        # Check if tasks file exists
        if not os.path.exists(tasks_file):
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Load tasks
        with open(tasks_file, 'r') as f:
            try:
                tasks = json.load(f)
            except json.JSONDecodeError:
                return jsonify({"success": False, "error": "Invalid tasks file"}), 500
        
        # Check if task exists
        if task_id not in tasks:
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Get task data
        task_data = tasks[task_id]
        
        # Check if task is already running
        status = get_task_status(task_id)
        if status == 'running':
            return jsonify({"success": False, "error": "Task is already running"}), 400
        
        # Reset completed status if the task was completed before
        if task_data.get('status') == 'completed':
            task_data['completedAt'] = None
        
        # Start task - pass current_app for Flask context
        # Use _get_current_object() to get the actual app object instead of the proxy
        success = start_task(task_id, task_data, current_app._get_current_object(), data_dir)
        
        if not success:
            return jsonify({"success": False, "error": "Failed to start task"}), 500
        
        # Update task status
        task_data['status'] = 'running'
        task_data['startedAt'] = datetime.datetime.now().isoformat()
        task_data['error'] = None  # Clear any previous errors
        tasks[task_id] = task_data
        
        # Save tasks
        with open(tasks_file, 'w') as f:
            json.dump(tasks, f, indent=2)
        
        # Log task start
        current_app.logger.info(f"Started task {task_id} ({task_data.get('name')})")
        
        return jsonify({
            "success": True,
            "message": "Task started successfully"
        })
    
    except Exception as e:
        current_app.logger.error(f"Error starting broadcasting task: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"Error starting task: {str(e)}"
        }), 500


@broadcaster_bp.route('/tasks/<task_id>/stop', methods=['POST'])
def stop_broadcasting_task(task_id):
    """Stop a broadcasting task with improved error handling"""
    try:
        data_dir = current_app.config.get('DATA_DIR', 'data')
        tasks_file = os.path.join(data_dir, 'broadcast_tasks.json')
        
        # Check if tasks file exists
        if not os.path.exists(tasks_file):
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Load tasks
        with open(tasks_file, 'r') as f:
            try:
                tasks = json.load(f)
            except json.JSONDecodeError:
                return jsonify({"success": False, "error": "Invalid tasks file"}), 500
        
        # Check if task exists
        if task_id not in tasks:
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Check if task is running
        status = get_task_status(task_id)
        if status != 'running':
            return jsonify({"success": False, "error": "Task is not running"}), 400
        
        # Stop task
        success = stop_task(task_id)
        
        if not success:
            return jsonify({"success": False, "error": "Failed to stop task"}), 500
        
        # Update task status
        tasks[task_id]['status'] = 'stopped'
        tasks[task_id]['completedAt'] = datetime.datetime.now().isoformat()
        
        # Save tasks
        with open(tasks_file, 'w') as f:
            json.dump(tasks, f, indent=2)
        
        # Log task stop
        current_app.logger.info(f"Stopped task {task_id} ({tasks[task_id].get('name')})")
        
        return jsonify({
            "success": True,
            "message": "Task stopped successfully"
        })
    
    except Exception as e:
        current_app.logger.error(f"Error stopping broadcasting task: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"Error stopping task: {str(e)}"
        }), 500


@broadcaster_bp.route('/upload-chat-list', methods=['POST'])
def upload_chat_list():
    """Upload a chat list file with improved validation and error handling"""
    try:
        # Check if the post request has the file part
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No file part"}), 400
        
        file = request.files['file']
        
        # If user does not select file, browser also submit an empty part without filename
        if file.filename == '':
            return jsonify({"success": False, "error": "No selected file"}), 400
        
        if file and file.filename.endswith('.txt'):
            filename = secure_filename(file.filename)
            # Add timestamp to filename to prevent caching issues
            timestamp = int(datetime.datetime.now().timestamp())
            filename = f"{timestamp}_{filename}"
            
            # Ensure uploads directory exists
            upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
            os.makedirs(upload_folder, exist_ok=True)
            
            file_path = os.path.join(upload_folder, filename)
            
            file.save(file_path)
            
            # Validate file contents
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    
                # Count non-empty lines
                valid_links = 0
                for line in lines:
                    line = line.strip()
                    if line and (line.startswith('@') or 't.me/' in line):
                        valid_links += 1
                
                if valid_links == 0:
                    os.remove(file_path)  # Clean up invalid file
                    return jsonify({
                        "success": False, 
                        "error": "File does not contain any valid Telegram chat links"
                    }), 400
                
                current_app.logger.info(f"Uploaded chat list with {valid_links} valid links")
            except Exception as e:
                os.remove(file_path)  # Clean up file in case of error
                return jsonify({
                    "success": False,
                    "error": f"Error reading file: {str(e)}"
                }), 400
            
            return jsonify({
                "success": True,
                "url": f"/uploads/{filename}",
                "valid_links": valid_links
            })
        
        return jsonify({"success": False, "error": "Invalid file type, only .txt files are allowed"}), 400
    
    except Exception as e:
        current_app.logger.error(f"Error uploading chat list: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"Error uploading chat list: {str(e)}"
        }), 500


@broadcaster_bp.route('/templates', methods=['GET'])
def get_message_templates():
    """Get message templates for the broadcaster"""
    from app.api.broadcaster.services import get_message_templates as fetch_templates
    
    try:
        templates = fetch_templates()
        return jsonify({
            "success": True,
            "templates": templates
        })
    except Exception as e:
        current_app.logger.error(f"Error getting message templates: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"Error getting templates: {str(e)}"
        }), 500


@broadcaster_bp.route('/templates', methods=['POST'])
def save_message_template():
    """Save a message template for the broadcaster"""
    from app.api.broadcaster.services import save_message_template
    
    try:
        data = request.json
        
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
            
        if 'text' not in data or not data['text'].strip():
            return jsonify({"success": False, "error": "Template text is required"}), 400
            
        if 'name' not in data or not data['name'].strip():
            return jsonify({"success": False, "error": "Template name is required"}), 400
            
        # Save the template
        template = save_message_template({
            "id": data.get('id'),  # Will be generated if not provided
            "name": data['name'],
            "text": data['text'],
            "description": data.get('description', '')
        })
        
        return jsonify({
            "success": True,
            "template": template
        })
    except Exception as e:
        current_app.logger.error(f"Error saving message template: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"Error saving template: {str(e)}"
        }), 500


@broadcaster_bp.route('/templates/<template_id>', methods=['DELETE'])
def delete_message_template(template_id):
    """Delete a message template"""
    from app.api.broadcaster.services import delete_message_template
    
    try:
        result = delete_message_template(template_id)
        
        if not result:
            return jsonify({"success": False, "error": "Template not found"}), 404
            
        return jsonify({
            "success": True,
            "message": "Template deleted successfully"
        })
    except Exception as e:
        current_app.logger.error(f"Error deleting message template: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"Error deleting template: {str(e)}"
        }), 500


@broadcaster_bp.route('/preview-message', methods=['POST'])
def preview_message():
    """Preview a message with template variables replaced"""
    try:
        data = request.json
        
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
            
        if 'message' not in data:
            return jsonify({"success": False, "error": "Message is required"}), 400
            
        # Get account data if an account ID was provided
        account_data = {}
        if 'accountId' in data:
            accounts = get_accounts()
            account = next((acc for acc in accounts if acc['id'] == data['accountId']), None)
            if account:
                account_data = {
                    'name': account.get('name', ''),
                    'username': account.get('username', ''),
                    'phone': account.get('phone', '')
                }
        
        # Format the message
        formatted_message = format_message_with_template_tags(
            data['message'], 
            account_data, 
            data.get('chat_name', 'Sample Chat')
        )
        
        return jsonify({
            "success": True,
            "original": data['message'],
            "formatted": formatted_message
        })
    except Exception as e:
        current_app.logger.error(f"Error formatting message preview: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"Error formatting message: {str(e)}"
        }), 500