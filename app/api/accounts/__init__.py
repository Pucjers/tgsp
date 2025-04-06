from flask import Blueprint

accounts_bp = Blueprint('accounts', __name__, url_prefix='/accounts')

from app.api.accounts import routes