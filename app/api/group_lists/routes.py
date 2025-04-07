# app/api/group_lists/routes.py

from flask import request, jsonify
from app.api.group_lists import group_lists_bp
from app.api.group_lists.services import (
    get_all_group_lists,
    create_group_list_item,
    update_group_list_item,
    delete_group_list_item
)


@group_lists_bp.route('', methods=['GET'])
def get_group_lists():
    """Get all group lists"""
    return jsonify(get_all_group_lists())


@group_lists_bp.route('', methods=['POST'])
def create_group_list():
    """Create a new group list"""
    data = request.json
    
    if 'name' not in data:
        return jsonify({"error": "List name is required"}), 400
    
    new_list = create_group_list_item(data)
    
    return jsonify(new_list), 201


@group_lists_bp.route('/<list_id>', methods=['PUT'])
def update_group_list(list_id):
    """Update an existing group list"""
    data = request.json
    
    updated_list = update_group_list_item(list_id, data)
    
    if not updated_list:
        return jsonify({"error": "List not found"}), 404
    
    return jsonify(updated_list)


@group_lists_bp.route('/<list_id>', methods=['DELETE'])
def delete_group_list(list_id):
    """Delete a group list"""
    result = delete_group_list_item(list_id)
    
    if 'error' in result:
        return jsonify({"error": result['error']}), 400
    
    return jsonify({"message": "List deleted successfully"})