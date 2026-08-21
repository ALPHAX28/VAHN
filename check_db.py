import time
import sys
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables from backend/.env
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
dotenv_path = os.path.join(backend_dir, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

def check_postgres_connection(retries=5, delay=2):
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        user = os.getenv("DB_USER", "vahn_user")
        password = os.getenv("DB_PASSWORD", "vahn_pass")
        host = os.getenv("DB_HOST", "localhost")
        port = os.getenv("DB_PORT", "5432")
        database = os.getenv("DB_NAME", "vahn_db")
        database_url = f"postgresql+pg8000://{user}:{password}@{host}:{port}/{database}"

    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif database_url.startswith("postgresql://") and "+psycopg2" not in database_url and "+pg8000" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    elif "+pg8000" in database_url:
        try:
            import psycopg2
            database_url = database_url.replace("+pg8000", "+psycopg2")
        except ImportError:
            pass

    # Strip query parameters for pg8000 compatibility
    if "+pg8000" in database_url and "?" in database_url:
        database_url = database_url.split("?")[0]

    # Extract host for display
    display_url = database_url
    if "@" in database_url:
        parts = database_url.split("@")
        display_url = f"...@{parts[-1]}"

    print(f"Checking database connection to: {display_url} ...")
    
    for i in range(retries):
        try:
            engine = create_engine(database_url, pool_pre_ping=True)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("Successfully connected to the database!")
            return True
        except Exception as e:
            print(f"Database connection attempt {i+1}/{retries} failed: {e}")
            if i < retries - 1:
                time.sleep(delay)
    return False

if __name__ == "__main__":
    if not check_postgres_connection():
        print("\nERROR: Could not establish a connection to PostgreSQL.")
        sys.exit(1)
    sys.exit(0)
