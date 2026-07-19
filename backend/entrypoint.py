import sys
import os
import time
import subprocess
from sqlalchemy import create_engine

# Read DATABASE_URL from environment
database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("ERROR: DATABASE_URL not set in the environment.")
    sys.exit(1)

# PostgreSQL warm-up loop
print("Checking database connection...")
engine = create_engine(database_url)
connected = False
for i in range(30):
    try:
        connection = engine.connect()
        connection.close()
        connected = True
        print("Connected to database successfully!")
        break
    except Exception as e:
        print(f"Database connection attempt {i+1}/30 failed: {e}")
        time.sleep(2)

if not connected:
    print("ERROR: Could not connect to database after 60 seconds. Aborting.")
    sys.exit(1)

# Run Alembic migrations
print("\n--- Running Alembic Migrations ---")
try:
    subprocess.run(["python", "-m", "alembic", "upgrade", "head"], check=True)
    print("✔ Alembic migrations applied successfully.")
except subprocess.CalledProcessError as err:
    print(f"✘ Alembic migrations failed: {err}")
    sys.exit(1)

# Run Database Seeder
print("\n--- Running Database Seeder ---")
try:
    subprocess.run(["python", "seed.py"], check=True)
    print("✔ Database seeding completed.")
except subprocess.CalledProcessError as err:
    print(f"✘ Database seeding failed: {err}")
    sys.exit(1)

# Start FastAPI production instance
print("\n--- Starting FastAPI Production Server ---")
host = os.getenv("HOST", "0.0.0.0")
port = os.getenv("PORT", "8000")
try:
    subprocess.run([
        "python", "-m", "uvicorn", "main:app",
        "--host", host,
        "--port", port,
        "--workers", "4"
    ], check=True)
except subprocess.CalledProcessError as err:
    print(f"✘ FastAPI server process exited with error: {err}")
    sys.exit(1)
