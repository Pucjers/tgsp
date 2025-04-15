from flask import request, jsonify, current_app
import os
import datetime
import json
import requests
import socket
import time
from typing import Dict, Any, List, Optional

from app.api.proxies import proxies_bp
from app.api.proxies.services import (
    get_all_proxies,
    get_proxy_by_id,
    create_proxy,
    update_proxy,
    delete_proxy,
    bulk_delete_proxies,
    test_proxy,
    test_multiple_proxies,
    import_proxies_from_text
)


@proxies_bp.route('', methods=['GET'])
def get_proxies():
    """Get all proxies"""
    return jsonify(get_all_proxies())


@proxies_bp.route('/<proxy_id>', methods=['GET'])
def get_proxy(proxy_id):
    """Get a specific proxy by ID"""
    proxy = get_proxy_by_id(proxy_id)
    
    if not proxy:
        return jsonify({"error": "Proxy not found"}), 404
    
    return jsonify(proxy)


@proxies_bp.route('', methods=['POST'])
def add_proxy():
    """Create a new proxy"""
    data = request.json
    
    # Basic validation
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    required_fields = ['type', 'host', 'port']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    proxy = create_proxy(data)
    return jsonify(proxy), 201


@proxies_bp.route('/<proxy_id>', methods=['PUT'])
def update_existing_proxy(proxy_id):
    """Update an existing proxy"""
    data = request.json
    
    updated_proxy = update_proxy(proxy_id, data)
    
    if not updated_proxy:
        return jsonify({"error": "Proxy not found"}), 404
    
    return jsonify(updated_proxy)


@proxies_bp.route('/<proxy_id>', methods=['DELETE'])
def delete_existing_proxy(proxy_id):
    """Delete a proxy by ID"""
    result = delete_proxy(proxy_id)
    
    if not result:
        return jsonify({"error": "Proxy not found or cannot be deleted"}), 404
    
    return jsonify({"message": "Proxy deleted successfully"})


@proxies_bp.route('/bulk-delete', methods=['POST'])
def bulk_delete():
    """Delete multiple proxies by their IDs"""
    data = request.json
    proxy_ids = data.get('proxy_ids', [])
    
    if not proxy_ids:
        return jsonify({"error": "No proxy IDs provided"}), 400
    
    result = bulk_delete_proxies(proxy_ids)
    
    if result.get('deleted_count', 0) == 0:
        return jsonify({"error": "No proxies found with the provided IDs"}), 404
    
    return jsonify({
        "message": f"Successfully deleted {result['deleted_count']} proxies",
        "deleted_count": result['deleted_count']
    })


@proxies_bp.route('/test', methods=['POST'])
def test_single_proxy():
    """Test a single proxy connection"""
    data = request.json
    
    # Basic validation
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    required_fields = ['type', 'host', 'port']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    result = test_proxy(data)
    return jsonify(result)


@proxies_bp.route('/test-multiple', methods=['POST'])
def test_proxies():
    """Test multiple proxies by their IDs"""
    data = request.json
    proxy_ids = data.get('proxy_ids', [])
    
    if not proxy_ids:
        return jsonify({"error": "No proxy IDs provided"}), 400
    
    results = test_multiple_proxies(proxy_ids)
    return jsonify(results)


@proxies_bp.route('/import', methods=['POST'])
def import_proxies():
    """Import proxies from a list of strings in various formats"""
    data = request.json
    proxy_list = data.get('proxies', [])
    
    if not proxy_list:
        return jsonify({"error": "No proxies provided"}), 400
    
    result = import_proxies_from_text(proxy_list)
    
    return jsonify({
        "message": f"Successfully imported {result['imported_count']} proxies",
        "imported_count": result['imported_count']
    })