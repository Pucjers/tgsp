from flask import request, jsonify
from app.api.lists import lists_bp
from app.api.lists.services import (
    get_all_lists,
    create_list_item,
    update_list_item,
    delete_list_item
)


@lists_bp.route('', methods=['GET'])
def get_lists():
    """Get all account lists"""
    return jsonify(get_all_lists())


@lists_bp.route('', methods=['POST'])
def create_list():
    """Create a new account list"""
    data = request.json
    
    if 'name' not in data:
        return jsonify({"error": "List name is required"}), 400
    
    new_list = create_list_item(data)
    
    return jsonify(new_list), 201


@lists_bp.route('/<list_id>', methods=['PUT'])
def update_list(list_id):
    """Update an existing account list"""
    data = request.json
    
    updated_list = update_list_item(list_id, data)
    
    if not updated_list:
        return jsonify({"error": "List not found"}), 404
    
    return jsonify(updated_list)


@lists_bp.route('/<list_id>', methods=['DELETE'])
def delete_list(list_id):
    """Delete an account list"""
    result = delete_list_item(list_id)
    
    if 'error' in result:
        return jsonify({"error": result['error']}), 400
    
    return jsonify({"message": "List deleted successfully"})