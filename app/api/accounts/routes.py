from flask import request, jsonify, current_app
import os
import datetime
import uuid
from werkzeug.utils import secure_filename

from app.api.accounts import accounts_bp
from app.api.accounts.services import (
    get_account_by_id, 
    create_new_account, 
    update_existing_account,
    delete_account_by_id,
    get_filtered_accounts,
    bulk_delete_accounts,
    move_accounts,
    check_accounts,
    import_tdata_zip
)
from app.utils.file_utils import allowed_file


@accounts_bp.route('', methods=['GET'])
def get_accounts():
    """Get all accounts, optionally filtered by list_id"""
    list_id = request.args.get('list_id', 'all')
    return jsonify(get_filtered_accounts(list_id))


@accounts_bp.route('', methods=['POST'])
def create_account():
    """Create a new account or update an existing one with the same phone number"""
    data = request.json
    
    # Basic validation
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    required_fields = ['phone', 'name']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    result = create_new_account(data)
    if result.get('updated', False):
        return jsonify(result.get('account')), 200
    else:
        return jsonify(result.get('account')), 201


@accounts_bp.route('/<account_id>', methods=['GET'])
def get_account(account_id):
    """Get a specific account by ID"""
    account = get_account_by_id(account_id)
    
    if not account:
        return jsonify({"error": "Account not found"}), 404
    
    return jsonify(account)


@accounts_bp.route('/<account_id>', methods=['PUT'])
def update_account(account_id):
    """Update an existing account"""
    data = request.json
    
    updated_account = update_existing_account(account_id, data)
    
    if not updated_account:
        return jsonify({"error": "Account not found"}), 404
    
    return jsonify(updated_account)


@accounts_bp.route('/<account_id>', methods=['DELETE'])
def delete_account(account_id):
    """Delete an account by ID"""
    result = delete_account_by_id(account_id)
    
    if not result:
        return jsonify({"error": "Account not found"}), 404
    
    return jsonify({"message": "Account deleted successfully"})


@accounts_bp.route('/bulk-delete', methods=['POST'])
def bulk_delete():
    """Delete multiple accounts by their IDs"""
    data = request.json
    account_ids = data.get('account_ids', [])
    
    if not account_ids:
        return jsonify({"error": "No account IDs provided"}), 400
    
    result = bulk_delete_accounts(account_ids)
    
    if result.get('deleted_count', 0) == 0:
        return jsonify({"error": "No accounts found with the provided IDs"}), 404
    
    return jsonify({
        "message": f"Successfully deleted {result['deleted_count']} accounts",
        "deleted_count": result['deleted_count']
    })


@accounts_bp.route('/move', methods=['POST'])
def move():
    """Move accounts between lists"""
    data = request.json
    account_ids = data.get('account_ids', [])
    target_list_id = data.get('target_list_id')
    action = data.get('action', 'move')  # 'add', 'remove', or 'move'
    
    if not account_ids:
        return jsonify({"error": "No account IDs provided"}), 400
    
    if not target_list_id:
        return jsonify({"error": "Target list ID is required"}), 400
    
    result = move_accounts(account_ids, target_list_id, action)
    
    return jsonify({
        "message": f"Successfully updated {result['updated_count']} accounts"
    })


@accounts_bp.route('/check', methods=['POST'])
def check():
    """Check the status of accounts with Telegram"""
    data = request.json
    account_ids = data.get('account_ids', [])
    
    if not account_ids:
        return jsonify({"error": "No account IDs provided"}), 400
    
    checked_accounts = check_accounts(account_ids)
    
    return jsonify(checked_accounts)


@accounts_bp.route('/upload-avatar', methods=['POST'])
def upload_avatar():
    # Log the request details
    current_app.logger.info("Upload avatar endpoint called")
    current_app.logger.info(f"Request files: {list(request.files.keys())}")
    
    # Accept either 'avatar' or 'image' field names for flexibility
    file = None
    field_name = None
    
    for field in ['avatar', 'image']:
        if field in request.files:
            file = request.files[field]
            field_name = field
            break
    
    # Check if we found a file
    if not file:
        available_fields = ", ".join(request.files.keys()) if request.files else "none"
        current_app.logger.error(f"No valid file field found. Available fields: {available_fields}")
        return jsonify({"error": f"No valid file field. Expected 'avatar' or 'image', got: {available_fields}"}), 400
    
    current_app.logger.info(f"Found file in '{field_name}' field: {file.filename}, type: {file.content_type}")
    
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
        
        file_path = os.path.join(upload_folder, filename)
        
        try:
            file.save(file_path)
            
            # Log the full file path for debugging
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
    allowed_extensions = current_app.config.get('ALLOWED_EXTENSIONS', {'png', 'jpg', 'jpeg', 'gif'})
    return jsonify({"error": f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"}), 400


@accounts_bp.route('/import-tdata-zip', methods=['POST'])
def import_tdata_zip_endpoint():
    """Import account from TData ZIP file"""
    if 'tdata_zip' not in request.files:
        return jsonify({"error": "No TData ZIP file provided"}), 400
    
    tdata_zip = request.files['tdata_zip']
    if tdata_zip.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if not tdata_zip.filename.endswith('.zip'):
        return jsonify({"error": "File must be a ZIP archive"}), 400
    
    # Get the target list ID if provided
    target_list_id = request.form.get('target_list_id', 'main')
    
    # Process the TData ZIP file
    result = import_tdata_zip(tdata_zip, target_list_id)
    
    if "error" in result:
        return jsonify({"error": result["error"]}), 400
    
    return jsonify(result)

