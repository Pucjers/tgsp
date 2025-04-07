from flask import request, jsonify, current_app
from app.api.groups import groups_bp
from app.api.groups.services import (
    get_filtered_groups,
    create_groups,
    delete_group_by_id,
    search_telegram_groups,
    move_groups
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
    
    # Log the request for debugging
    current_app.logger.info(f"Searching for groups with keywords: {keywords}, language: {language}")
    
    # Perform the search
    try:
        groups = search_telegram_groups(keywords, language)
        
        # Log the result count for monitoring
        current_app.logger.info(f"Found {len(groups)} groups matching the criteria")
        
        return jsonify(groups)
    except Exception as e:
        current_app.logger.error(f"Error during group search: {str(e)}")
        return jsonify({"error": "An error occurred during search"}), 500
    
@groups_bp.route('/move', methods=['POST'])
def move_groups_to_list():
    """Move groups between lists"""
    data = request.json
    group_ids = data.get('group_ids', [])
    target_list_id = data.get('target_list_id')
    
    if not group_ids:
        return jsonify({"error": "No group IDs provided"}), 400
    
    if not target_list_id:
        return jsonify({"error": "Target list ID is required"}), 400
    
    result = move_groups(group_ids, target_list_id)
    
    return jsonify({
        "message": f"Successfully moved {result['updated_count']} groups",
        "updated_count": result['updated_count']
    })

@groups_bp.route('/move', methods=['POST'])
def move_groups_to_list():
    """Move groups between lists"""
    data = request.json
    group_ids = data.get('group_ids', [])
    target_list_id = data.get('target_list_id')
    action = data.get('action', 'move')  # 'move', 'add', or 'remove'
    
    if not group_ids:
        return jsonify({"error": "No group IDs provided"}), 400
    
    if not target_list_id:
        return jsonify({"error": "Target list ID is required"}), 400
    
    result = move_groups(group_ids, target_list_id, action)
    
    action_text = "moved"
    if action == 'add':
        action_text = "added to list"
    elif action == 'remove':
        action_text = "removed from list"
    
    return jsonify({
        "message": f"Successfully {action_text} {result['updated_count']} groups",
        "updated_count": result['updated_count']
    })