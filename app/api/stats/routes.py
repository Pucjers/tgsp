from flask import request, jsonify
from app.api.stats import stats_bp
from app.api.stats.services import get_account_statistics


@stats_bp.route('', methods=['GET'])
def get_stats():
    """Get account statistics, optionally filtered by list_id"""
    list_id = request.args.get('list_id', 'all')
    return jsonify(get_account_statistics(list_id))