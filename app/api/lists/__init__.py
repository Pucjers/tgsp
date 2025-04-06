from flask import Blueprint

lists_bp = Blueprint('lists', __name__, url_prefix='/account-lists')

from app.api.lists import routes