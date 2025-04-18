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

    bootstrap_telegram_import_api()
    init_broadcaster_tasks()

    return app

def bootstrap_telegram_import_api():
    """
    Bootstrap the new Telegram import API endpoints.
    This function should be called from app/__init__.py during application startup.
    """
    import os
    import logging
    
    # Create necessary directories
    for directory in ['saved_sessions', 'uploads']:
        os.makedirs(directory, exist_ok=True)
    
    # Set up logging for Telethon
    logging.basicConfig(
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        level=logging.INFO
    )
    
    # Check for required dependencies
    try:
        import telethon
        from telethon import TelegramClient
        print("Telethon is available - Session and Phone account import enabled")
    except ImportError:
        print("Telethon is not available - Session and Phone account import disabled")
        print("To enable, install with: pip install telethon")
    
    try:
        import asyncio
        print("Asyncio is available")
    except ImportError:
        print("Asyncio is not available - Required for Telegram operations")
        print("To enable, install with: pip install asyncio")
    
    # Verify API credentials
    config_path = os.path.join(os.getcwd(), "data", "telegram_api.ini")
    if not os.path.exists(config_path):
        print("Warning: Telegram API credentials file not found at", config_path)
        print("Using default testing credentials. For production, create this file with your API ID and hash.")
    
    # Print information about the new endpoints
    print("\nNew API endpoints available:")
    print("- POST /api/accounts/import-session - Import account from session file")
    print("- POST /api/accounts/request-code - Request phone verification code")
    print("- POST /api/accounts/verify-code - Verify phone number with code")
    
    return True


def init_broadcaster_tasks(app=None):
    """
    Initialize the broadcaster task system.
    This should be called in app/__init__.py during application startup.
    
    Args:
        app: The Flask application instance
    """
    import os
    import logging
    import threading
    import json
    import time
    from datetime import datetime
    
    # Create necessary directory for tasks
    data_dir = os.path.join(os.getcwd(), "data")
    os.makedirs(data_dir, exist_ok=True)
    
    # Set up logging
    logging.basicConfig(
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        level=logging.INFO
    )
    
    # Import task system
    try:
        from app.services.broadcaster_tasks import start_task, task_registry, cleanup_tasks
        
        # Check if there are any running tasks that need to be restarted
        tasks_file = os.path.join(data_dir, 'broadcast_tasks.json')
        if os.path.exists(tasks_file):
            try:
                with open(tasks_file, 'r') as f:
                    tasks = json.load(f)
                    
                # Look for tasks that were running
                for task_id, task_data in tasks.items():
                    if task_data.get('status') == 'running':
                        # Update status to indicate restart
                        task_data['status'] = 'restarting'
                        logger = logging.getLogger(__name__)
                        logger.info(f"Restarting task {task_id} that was running before server shutdown")
                        
                        # Start task in a background thread to avoid blocking startup
                        def delayed_start(task_id, task_data):
                            time.sleep(5)  # Wait for app to fully initialize
                            try:
                                # Pass the Flask app instance to provide context
                                start_task(task_id, task_data, app, data_dir)
                                logger.info(f"Successfully restarted task {task_id}")
                            except Exception as e:
                                logger.error(f"Failed to restart task {task_id}: {str(e)}")
                                # Mark as error in the task file
                                try:
                                    with open(tasks_file, 'r') as f:
                                        current_tasks = json.load(f)
                                    if task_id in current_tasks:
                                        current_tasks[task_id]['status'] = 'error'
                                        current_tasks[task_id]['error'] = f"Failed to restart: {str(e)}"
                                        with open(tasks_file, 'w') as f:
                                            json.dump(current_tasks, f, indent=2)
                                except Exception as err:
                                    logger.error(f"Error updating task file: {str(err)}")
                        
                        # Start the delayed restart thread
                        restart_thread = threading.Thread(
                            target=delayed_start,
                            args=(task_id, task_data)
                        )
                        restart_thread.daemon = True
                        restart_thread.start()
                
                # Set up periodic cleanup of completed tasks
                def periodic_cleanup():
                    while True:
                        time.sleep(300)  # Run every 5 minutes
                        try:
                            cleanup_tasks()
                        except Exception as e:
                            logging.error(f"Error during periodic task cleanup: {str(e)}")
                
                # Start the cleanup thread
                cleanup_thread = threading.Thread(target=periodic_cleanup)
                cleanup_thread.daemon = True
                cleanup_thread.start()
                
            except Exception as e:
                logging.error(f"Error loading tasks file during initialization: {str(e)}")
    except ImportError as e:
        logging.error(f"Error importing broadcaster_tasks module: {str(e)}")
    except Exception as e:
        logging.error(f"Error initializing broadcaster task system: {str(e)}")
    
    print("Broadcaster task system initialized")
    
    return True