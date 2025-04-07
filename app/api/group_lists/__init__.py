# app/api/group_lists/__init__.py

from flask import Blueprint

group_lists_bp = Blueprint('group_lists', __name__, url_prefix='/group-lists')

from app.api.group_lists import routes