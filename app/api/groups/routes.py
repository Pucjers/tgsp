from flask import request, jsonify
from app.api.groups import groups_bp
from app.api.groups.services import (
    get_filtered_groups,
    create_groups,
    delete_group_by_id,
    search_telegram_groups
)


@groups_bp.route('', methods=['GET'])
def get_groups():
    """Get all saved groups, optionally filtered by list_id"""
    list_id = request.args.get('list_id', 'all')
    return jsonify(get_filtered_groups(list_id))


@groups_bp.route('', methods=['POST'])
def save_groups():
    """Save one or more Telegram groups"""
    data = request.json
    groups = data.get('groups', [])
    list_id = data.get('list_id', 'main')
    
    if not groups:
        return jsonify({"error": "No groups provided"}), 400
    
    saved_groups = create_groups(groups, list_id)
    
    return jsonify({"saved_groups": saved_groups})


@groups_bp.route('/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    """Delete a saved group"""
    result = delete_group_by_id(group_id)
    
    if not result:
        return jsonify({"error": "Group not found"}), 404
    
    return jsonify({"message": "Group deleted successfully"})


@groups_bp.route('/search', methods=['POST'])
def search_groups():
    """Search for Telegram groups based on keywords"""
    data = request.json
    keywords = data.get('keywords', [])
    language = data.get('language', 'all')
    
    if not keywords:
        return jsonify({"error": "No keywords provided"}), 400
    
    groups = search_telegram_groups(keywords, language)
    
    return jsonify(groups)