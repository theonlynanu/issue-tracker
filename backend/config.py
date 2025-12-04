import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)
    
    
class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", 'dev-secret')
    DEBUG = bool(int(os.environ.get("FLASK_DEBUG", "1")))
    ENV = os.environ.get("FLASK_ENV", "development")
    
    DB_HOST = os.environ.get("DB_HOST", "localhost")
    DB_PORT = int(os.environ.get("DB_PORT", 3306))  # 3306 is MySQL default
    DB_NAME = os.environ.get("DB_NAME", "itms")
    DB_USER = os.environ.get("DB_USER", "root")
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
    FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173") # Default for Vite dev