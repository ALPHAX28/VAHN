import time
import sys
import os
import pg8000.dbapi
from dotenv import load_dotenv

# Load environment variables from backend/.env
dotenv_path = os.path.join(os.path.dirname(__file__), 'backend', '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

def check_postgres_connection(retries=5, delay=2):
    user = os.getenv("DB_USER", "vahn_user")
    password = os.getenv("DB_PASSWORD", "vahn_pass")
    host = os.getenv("DB_HOST", "localhost")
    port = int(os.getenv("DB_PORT", "5432"))
    database = os.getenv("DB_NAME", "vahn_db")

    print(f"Checking database connection ({host}:{port}/{database})...")
    for i in range(retries):
        try:
            conn = pg8000.dbapi.connect(
                user=user,
                password=password,
                host=host,
                port=port,
                database=database
            )
            conn.close()
            print("Successfully connected to the database!")
            return True
        except Exception as e:
            print(f"Database connection attempt {i+1}/{retries} failed: {e}. Is Docker running?")
            if i < retries - 1:
                time.sleep(delay)
    return False

if __name__ == "__main__":
    if not check_postgres_connection():
        print("\nERROR: Could not establish a connection to PostgreSQL.")
        print("Please ensure Docker is open and running, and the PostgreSQL container has started.")
        print("Run 'npm run setup:docker' to build and run the Postgres container first.\n")
        sys.exit(1)
    sys.exit(0)
