from flask import Blueprint

stats_bp = Blueprint('stats', __name__, url_prefix='/stats')

from app.api.stats import routes