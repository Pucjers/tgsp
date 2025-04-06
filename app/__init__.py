from flask import Flask
from flask_cors import CORS
import os

def create_app(config=None):
    """Create and configure the Flask application"""
    # Create essential directories
    for directory in ['data', 'uploads', 'saved_sessions', 'static']:
        os.makedirs(directory, exist_ok=True)
    
    # Create specific static subdirectories
    for static_dir in ['css', 'js', 'img']:
        os.makedirs(os.path.join('static', static_dir), exist_ok=True)
    
    app = Flask(__name__, 
                static_folder='../static', 
                static_url_path='', 
                template_folder='../templates')
    
    # Apply default configuration
    app.config.from_mapping(
        UPLOAD_FOLDER='uploads',
        MAX_CONTENT_LENGTH=16 * 1024 * 1024,  # 16MB max upload
        ALLOWED_EXTENSIONS={'png', 'jpg', 'jpeg', 'gif'},
        SESSIONS_DIR='saved_sessions',
        DATA_DIR='data'
    )
    
    # Override with provided config if any
    if config:
        app.config.update(config)
    
    # Enable CORS
    CORS(app)
    
    # Register blueprints
    from app.api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')
    
    # Register main routes
    from app.routes import main_bp
    app.register_blueprint(main_bp)
    
    return app