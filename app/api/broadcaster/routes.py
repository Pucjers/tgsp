from flask import request, jsonify, current_app
import os
import datetime
import json
from werkzeug.utils import secure_filename

from app.api.broadcaster import broadcaster_bp
from app.api.broadcaster.services import (
    save_message_template,
    get_message_templates,
    get_message_template,
    delete_message_template
)
from app.utils.file_utils import allowed_file


@broadcaster_bp.route('/templates', methods=['GET'])
def get_templates():
    """Get all message templates"""
    return jsonify(get_message_templates())


@broadcaster_bp.route('/templates/<template_id>', methods=['GET'])
def get_template(template_id):
    """Get a specific message template"""
    template = get_message_template(template_id)
    if not template:
        return jsonify({"error": "Template not found"}), 404
    
    return jsonify(template)


@broadcaster_bp.route('/templates', methods=['POST'])
def create_template():
    """Create a new message template"""
    data = request.json
    
    if not data or 'name' not in data or 'message' not in data:
        return jsonify({"error": "Missing required fields: name and message"}), 400
    
    template = save_message_template(data)
    return jsonify(template), 201


@broadcaster_bp.route('/templates/<template_id>', methods=['DELETE'])
def delete_template(template_id):
    """Delete a message template"""
    if delete_message_template(template_id):
        return jsonify({"message": "Template deleted successfully"})
    
    return jsonify({"error": "Template not found"}), 404


@broadcaster_bp.route('/upload-image', methods=['POST'])
def upload_image():
    """Upload an image for broadcasting"""
    current_app.logger.info("Broadcast upload-image endpoint called")
    
    # Check if the post request has the file part
    if 'image' not in request.files:
        current_app.logger.error("No 'image' field in the request files")
        current_app.logger.debug(f"Request files: {request.files.keys()}")
        return jsonify({"error": "No file part named 'image'. Available files: " + ", ".join(request.files.keys())}), 400
    
    file = request.files['image']
    current_app.logger.info(f"Received file: {file.filename}, type: {file.content_type}, size: {len(file.read())} bytes")
    file.seek(0)  # Reset file position after reading
    
    # If user does not select file, browser also submit an empty part without filename
    if file.filename == '':
        current_app.logger.error("Empty filename in uploaded file")
        return jsonify({"error": "No selected file"}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Add timestamp to filename to prevent caching issues
        timestamp = int(datetime.datetime.now().timestamp())
        filename = f"{timestamp}_{filename}"
        
        # Ensure uploads directory exists
        upload_folder = current_app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True)
        current_app.logger.info(f"Upload folder: {upload_folder}")
        
        file_path = os.path.join(upload_folder, filename)
        
        try:
            file.save(file_path)
            current_app.logger.info(f"File saved to: {file_path}")
            
            # Check if file was actually saved
            if os.path.exists(file_path):
                current_app.logger.info(f"File exists at {file_path}, size: {os.path.getsize(file_path)} bytes")
            else:
                current_app.logger.error(f"File does not exist at {file_path} after saving")
                return jsonify({"error": "Failed to save file: file not found after save"}), 500
            
            # Return path to uploaded file
            return jsonify({"url": f"/uploads/{filename}"})
        except Exception as e:
            current_app.logger.error(f"Error saving file: {str(e)}", exc_info=True)
            return jsonify({"error": f"Failed to save file: {str(e)}"}), 500
    
    current_app.logger.error(f"File type not allowed: {file.filename}")
    return jsonify({"error": f"File type not allowed. Allowed types: {', '.join(current_app.config['ALLOWED_EXTENSIONS'])}"}), 400


@broadcaster_bp.route('/send-message', methods=['POST'])
def send_message():
    """Send a message to a Telegram group"""
    current_app.logger.info("Broadcast send-message endpoint called")
    
    try:
        data = request.json
        current_app.logger.info(f"Received data: account_id={data.get('account_id')}, group_id={data.get('group_id')}")
        current_app.logger.info(f"Message length: {len(data.get('message', ''))}")
        current_app.logger.info(f"Number of images: {len(data.get('image_urls', []))}")
        
        # Check for required fields
        if not data:
            current_app.logger.error("No JSON data in request")
            return jsonify({"success": False, "error": "No data provided"}), 400
            
        if 'account_id' not in data:
            current_app.logger.error("Missing account_id in request")
            return jsonify({"success": False, "error": "account_id is required"}), 400
            
        if 'group_id' not in data:
            current_app.logger.error("Missing group_id in request")
            return jsonify({"success": False, "error": "group_id is required"}), 400
            
        if 'message' not in data:
            current_app.logger.error("Missing message in request")
            return jsonify({"success": False, "error": "message is required"}), 400
        
        # Get account and group info
        from app.api.accounts.services import get_account_by_id
        from app.api.groups.services import get_group_by_id
        from app.utils.file_utils import get_accounts_meta
        
        account_id = data['account_id']
        group_id = data['group_id']
        message = data['message']
        image_urls = data.get('image_urls', [])
        
        account = get_account_by_id(account_id)
        group = get_group_by_id(group_id)
        
        if not account:
            current_app.logger.error(f"Account not found: {account_id}")
            return jsonify({"success": False, "error": "Account not found"}), 404
            
        if not group:
            current_app.logger.error(f"Group not found: {group_id}")
            return jsonify({"success": False, "error": "Group not found"}), 404
        
        # Get account metadata to find the session file
        accounts_meta = get_accounts_meta()
        account_meta = accounts_meta.get(account_id, {})
        
        session_path = account_meta.get('session_path')
        telegram_id = account_meta.get('telegram_id')
        
        current_app.logger.info(f"Found metadata: session_path={session_path}, telegram_id={telegram_id}")
        
        # Try to find the session file in multiple places
        if session_path and os.path.exists(session_path):
            # If the stored path exists, use it
            current_app.logger.info(f"Using stored session path: {session_path}")
        elif telegram_id:
            # If we have the telegram ID, try to find the session file
            # Check in the application's sessions directory
            sessions_dir = current_app.config.get('SESSIONS_DIR', 'saved_sessions')
            possible_paths = [
                os.path.join(sessions_dir, f"{telegram_id}.session"),
                os.path.join(os.getcwd(), sessions_dir, f"{telegram_id}.session"),
                os.path.join(os.getcwd(), "saved_sessions", f"{telegram_id}.session"),
                os.path.join("saved_sessions", f"{telegram_id}.session")
            ]
            
            # Try each path
            found_path = None
            for path in possible_paths:
                current_app.logger.info(f"Checking for session at: {path}")
                if os.path.exists(path):
                    found_path = path
                    break
            
            if found_path:
                current_app.logger.info(f"Found session at alternative path: {found_path}")
                session_path = found_path
                
                # Update the metadata for future use
                account_meta['session_path'] = session_path
                accounts_meta[account_id] = account_meta
                from app.utils.file_utils import save_accounts_meta
                save_accounts_meta(accounts_meta)
            else:
                # Also try using the phone number as a fallback
                phone = account.get('phone', '').replace('+', '')
                if phone:
                    possible_phone_paths = [
                        os.path.join(sessions_dir, f"{phone}.session"),
                        os.path.join(os.getcwd(), sessions_dir, f"{phone}.session"),
                        os.path.join(os.getcwd(), "saved_sessions", f"{phone}.session"),
                        os.path.join("saved_sessions", f"{phone}.session")
                    ]
                    
                    for path in possible_phone_paths:
                        current_app.logger.info(f"Checking for session with phone at: {path}")
                        if os.path.exists(path):
                            found_path = path
                            break
                    
                    if found_path:
                        current_app.logger.info(f"Found session using phone at: {found_path}")
                        session_path = found_path
                        
                        # Update the metadata for future use
                        account_meta['session_path'] = session_path
                        accounts_meta[account_id] = account_meta
                        from app.utils.file_utils import save_accounts_meta
                        save_accounts_meta(accounts_meta)
        
        if not session_path or not os.path.exists(session_path):
            current_app.logger.error(f"No valid session path found for account {account_id}")
            return jsonify({
                "success": False, 
                "error": "No session found for this account. Please check that the account has been properly imported with TData."
            }), 400
        
        current_app.logger.info(f"Using session path: {session_path}")
        current_app.logger.info(f"Group target: {group.get('username', group.get('telegram_id', 'unknown'))}")
        
        # Determine the group identifier to use (username preferred, or telegram_id)
        group_identifier = group.get('username', group.get('telegram_id'))
        
        if not group_identifier:
            current_app.logger.error(f"No valid identifier found for group {group_id}")
            return jsonify({"success": False, "error": "No valid group identifier found"}), 400
        
        # Process image URLs
        image_urls = data.get('image_urls', [])
        processed_image_urls = []
        
        for url in image_urls:
            # Check if the URL is valid
            if url and isinstance(url, str):
                if url.startswith('/uploads/'):
                    # Check if the file exists
                    upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
                    file_name = os.path.basename(url)
                    absolute_path = os.path.abspath(os.path.join(upload_folder, file_name))
                    
                    if os.path.exists(absolute_path):
                        current_app.logger.info(f"Image file found: {absolute_path}")
                        processed_image_urls.append(url)
                    else:
                        current_app.logger.warning(f"Image file not found: {absolute_path} - URL: {url}")
                else:
                    # For external URLs or other formats, just keep them
                    processed_image_urls.append(url)
        
        current_app.logger.info(f"Processed {len(processed_image_urls)} valid image URLs out of {len(image_urls)}")
        
        # Use our telegram sender to send the message
        from app.services.telegram_sender import send_message as telegram_send
        
        result = telegram_send(
            session_path=session_path,
            group_id=group_identifier,
            message_text=message,
            image_paths=processed_image_urls
        )
        
        current_app.logger.info(f"Send result: {result}")
        
        return jsonify(result)
        
    except Exception as e:
        current_app.logger.error(f"Error in send_message endpoint: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}"
        }), 500