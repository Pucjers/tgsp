# app/api/__init__.py
from flask import Blueprint

# Create the main API blueprint
api_bp = Blueprint('api', __name__)

# Import and register the sub-blueprints
from app.api.accounts import accounts_bp
from app.api.lists import lists_bp
from app.api.groups import groups_bp
from app.api.group_lists import group_lists_bp
from app.api.stats import stats_bp
from app.api.broadcaster import broadcaster_bp

api_bp.register_blueprint(accounts_bp)
api_bp.register_blueprint(lists_bp)
api_bp.register_blueprint(groups_bp)
api_bp.register_blueprint(group_lists_bp)
api_bp.register_blueprint(stats_bp)
api_bp.register_blueprint(broadcaster_bp)