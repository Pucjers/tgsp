"""
Enhanced broadcaster routes for the Telegram broadcaster application.
This module provides API endpoints for the enhanced broadcaster functionality.
"""

from flask import request, jsonify, current_app
import os
import datetime
import json
import uuid
import tempfile
from werkzeug.utils import secure_filename

from app.api.broadcaster import broadcaster_bp
from app.utils.file_utils import allowed_file, get_accounts


@broadcaster_bp.route('/create-task', methods=['POST'])
def create_broadcasting_task():
    """Create a new broadcasting task"""
    try:
        # Get request data
        data = request.json
        
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
        
        # Validate required fields
        required_fields = ['name', 'mode', 'workMode', 'selectedAccounts']
        for field in required_fields:
            if field not in data:
                return jsonify({"success": False, "error": f"Missing required field: {field}"}), 400
        
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
        
        # Create task object
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
            }
        }
        
        # Save task to JSON file
        tasks_file = os.path.join(current_app.config.get('DATA_DIR', 'data'), 'broadcast_tasks.json')
        
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
        with open(tasks_file, 'w') as f:
            json.dump(tasks, f, indent=2)
        
        # Check if auto-run is requested
        auto_run = data.get('auto_run', False)
        if auto_run:
            # Start task logic would go here
            task['status'] = 'running'
            task['startedAt'] = datetime.datetime.now().isoformat()
            
            # Save updated task status
            with open(tasks_file, 'w') as f:
                json.dump(tasks, f, indent=2)
            
            # In a real implementation, you would start a background task here
            
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
    """Get all broadcasting tasks or a specific task by ID"""
    try:
        task_id = request.args.get('task_id')
        tasks_file = os.path.join(current_app.config.get('DATA_DIR', 'data'), 'broadcast_tasks.json')
        
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
                tasks = {}
        
        # Return specific task or all tasks
        if task_id:
            if task_id in tasks:
                return jsonify({
                    "success": True,
                    "task": tasks[task_id]
                })
            return jsonify({"success": False, "error": "Task not found"}), 404
        
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
    """Delete a broadcasting task"""
    try:
        tasks_file = os.path.join(current_app.config.get('DATA_DIR', 'data'), 'broadcast_tasks.json')
        
        # Check if tasks file exists
        if not os.path.exists(tasks_file):
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Load tasks
        with open(tasks_file, 'r') as f:
            try:
                tasks = json.load(f)
            except json.JSONDecodeError:
                tasks = {}
        
        # Check if task exists
        if task_id not in tasks:
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Check if task is running
        if tasks[task_id].get('status') == 'running':
            return jsonify({"success": False, "error": "Cannot delete a running task"}), 400
        
        # Delete task
        del tasks[task_id]
        
        # Save tasks
        with open(tasks_file, 'w') as f:
            json.dump(tasks, f, indent=2)
        
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
    """Start a broadcasting task"""
    try:
        tasks_file = os.path.join(current_app.config.get('DATA_DIR', 'data'), 'broadcast_tasks.json')
        
        # Check if tasks file exists
        if not os.path.exists(tasks_file):
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Load tasks
        with open(tasks_file, 'r') as f:
            try:
                tasks = json.load(f)
            except json.JSONDecodeError:
                tasks = {}
        
        # Check if task exists
        if task_id not in tasks:
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Check if task is already running
        if tasks[task_id].get('status') == 'running':
            return jsonify({"success": False, "error": "Task is already running"}), 400
        
        # Update task status
        tasks[task_id]['status'] = 'running'
        tasks[task_id]['startedAt'] = datetime.datetime.now().isoformat()
        
        # Save tasks
        with open(tasks_file, 'w') as f:
            json.dump(tasks, f, indent=2)
        
        # In a real implementation, you would start a background task here
        
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
    """Stop a broadcasting task"""
    try:
        tasks_file = os.path.join(current_app.config.get('DATA_DIR', 'data'), 'broadcast_tasks.json')
        
        # Check if tasks file exists
        if not os.path.exists(tasks_file):
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Load tasks
        with open(tasks_file, 'r') as f:
            try:
                tasks = json.load(f)
            except json.JSONDecodeError:
                tasks = {}
        
        # Check if task exists
        if task_id not in tasks:
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Check if task is running
        if tasks[task_id].get('status') != 'running':
            return jsonify({"success": False, "error": "Task is not running"}), 400
        
        # Update task status
        tasks[task_id]['status'] = 'stopped'
        
        # Save tasks
        with open(tasks_file, 'w') as f:
            json.dump(tasks, f, indent=2)
        
        # In a real implementation, you would stop the background task here
        
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
    """Upload a chat list file"""
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
            
            return jsonify({
                "success": True,
                "url": f"/uploads/{filename}"
            })
        
        return jsonify({"success": False, "error": "Invalid file type, only .txt files are allowed"}), 400
    
    except Exception as e:
        current_app.logger.error(f"Error uploading chat list: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"Error uploading chat list: {str(e)}"
        }), 500