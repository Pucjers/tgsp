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
        # Instead of app.config.update(config), let's extract config attributes
        if hasattr(config, '__dict__'):
            # If config is an object with __dict__ attribute
            for key, value in vars(config).items():
                if not key.startswith('__'):
                    app.config[key] = value
        else:
            # Handle other cases (like dictionary)
            try:
                for key in config:
                    if key.isupper():  # Flask config keys are uppercase by convention
                        app.config[key] = config[key]
            except TypeError:
                # If config is neither an object with __dict__ nor iterable
                pass
    
    # Enable CORS
    CORS(app)
    
    # Register blueprints
    from app.api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')
    
    # Register main routes
    from app.routes import main_bp
    app.register_blueprint(main_bp)
    

    print("Registered routes:")
    for rule in app.url_map.iter_rules():
        print(f"{rule.endpoint}: {rule}")

    return app