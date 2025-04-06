import os

class Config:
    """Base configuration"""
    # Base directory of the application
    BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    
    # Data storage
    DATA_DIR = os.path.join(BASE_DIR, 'data')
    ACCOUNTS_FILE = os.path.join(DATA_DIR, 'accounts.json')
    LISTS_FILE = os.path.join(DATA_DIR, 'account_lists.json')
    ACCOUNTS_META_FILE = os.path.join(DATA_DIR, 'accounts_meta.json')
    
    # File uploads
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    
    # Telegram sessions
    SESSIONS_DIR = os.path.join(BASE_DIR, 'saved_sessions')
    
    # Telegram API (default values, should be overridden)
    TELEGRAM_API_ID = os.environ.get('TELEGRAM_API_ID', '149467')
    TELEGRAM_API_HASH = os.environ.get('TELEGRAM_API_HASH', '65f1b75a0b1d5a6461c1fc67b5514c1b')


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False


# Configuration dictionary
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}


def get_config():
    """Get configuration based on environment"""
    env = os.environ.get('FLASK_ENV', 'default')
    return config_by_name[env]