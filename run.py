from app import create_app
from app.config import get_config

# Create app with the appropriate configuration
app = create_app(get_config())

if __name__ == '__main__':
    print("Starting TgNinja API server...")
    print(f"Frontend files will be served from: {app.static_folder}")
    print(f"Upload folder: {app.config['UPLOAD_FOLDER']}")
    
    # Check if TData support is available
    try:
        from app.services.tdata_integration import convert_zip_tdata_and_get_account
        print("TData support: Enabled")
    except ImportError:
        print("TData support: Disabled")
    
    # Run the app
    app.run(debug=app.config.get('DEBUG', True))