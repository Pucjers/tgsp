from flask import Blueprint

broadcaster_bp = Blueprint('broadcaster', __name__, url_prefix='/broadcaster')

from app.api.broadcaster import routes