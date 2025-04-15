from flask import Blueprint

proxies_bp = Blueprint('proxies', __name__, url_prefix='/proxies')

from app.api.proxies import routes