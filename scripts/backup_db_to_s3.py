#!/usr/bin/env python3
"""
VAHN Automated Database Backup Engine -> Amazon S3
Connects to PostgreSQL, generates a compressed SQL dump, and uploads to AWS S3.
Can be executed manually or automatically via cron / scheduler.
"""

import os
import sys
import gzip
import io
import datetime
import subprocess
from pathlib import Path
from dotenv import load_dotenv

# Load backend environment variables
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
ENV_PATH = BACKEND_DIR / ".env"
load_dotenv(ENV_PATH)

AWS_BUCKET_NAME = os.getenv("AWS_BUCKET_NAME", "vahn")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-2")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+pg8000://vahn_user:vahn_pass@localhost:5432/vahn_db")
DB_USER = os.getenv("DB_USER", "vahn_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "vahn_pass")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "vahn_db")

LOCAL_BACKUP_DIR = Path(__file__).resolve().parent.parent / "backups" / "db"
LOCAL_BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def get_s3_client():
    import boto3
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )


def dump_postgres_to_sql_bytes() -> bytes:
    """Attempts pg_dump via docker, local pg_dump, or SQLAlchemy data extraction."""
    timestamp = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    
    # 1. Try Docker container pg_dump
    for container_name in ["vahn-postgres-db-prod", "vahn-postgres-db", "nextjs-vahn-db-1"]:
        try:
            cmd = ["docker", "exec", container_name, "pg_dump", "-U", DB_USER, "-d", DB_NAME]
            proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            if proc.stdout and len(proc.stdout) > 100:
                print(f"✔ Dumped database via Docker container '{container_name}'")
                return proc.stdout
        except Exception:
            pass

    # 2. Try native pg_dump CLI
    try:
        env = os.environ.copy()
        env["PGPASSWORD"] = DB_PASSWORD
        cmd = ["pg_dump", "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME]
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, check=True)
        if proc.stdout and len(proc.stdout) > 100:
            print("✔ Dumped database via native pg_dump CLI")
            return proc.stdout
    except Exception:
        pass

    # 3. Fallback: SQLAlchemy Python Schema & Data Dumper
    print("--> Using SQLAlchemy data extraction for SQL dump...")
    sys.path.insert(0, str(BACKEND_DIR))
    from sqlalchemy import create_engine, MetaData, select
    import json

    engine = create_engine(DATABASE_URL)
    meta = MetaData()
    meta.reflect(bind=engine)

    sql_lines = [
        f"-- VAHN Automated Database Backup",
        f"-- Timestamp: {timestamp}",
        f"-- Database: {DB_NAME}",
        "BEGIN;\n"
    ]

    with engine.connect() as conn:
        for table in reversed(meta.sorted_tables):
            sql_lines.append(f"TRUNCATE TABLE \"{table.name}\" CASCADE;")
        sql_lines.append("\n")

        for table in meta.sorted_tables:
            stmt = select(table)
            rows = conn.execute(stmt).fetchall()
            if not rows:
                continue

            cols = [c.name for c in table.columns]
            cols_str = ", ".join([f'"{c}"' for c in cols])
            
            for row in rows:
                row_dict = row._mapping
                vals = []
                for c in cols:
                    v = row_dict[c]
                    if v is None:
                        vals.append("NULL")
                    elif isinstance(v, (int, float)):
                        vals.append(str(v))
                    elif isinstance(v, bool):
                        vals.append("TRUE" if v else "FALSE")
                    elif isinstance(v, (dict, list)):
                        escaped_json = json.dumps(v).replace("'", "''")
                        vals.append(f"'{escaped_json}'::json")
                    elif isinstance(v, datetime.datetime):
                        vals.append(f"'{v.strftime('%Y-%m-%d %H:%M:%S.%f')}'")
                    else:
                        escaped_str = str(v).replace("'", "''")
                        vals.append(f"'{escaped_str}'")
                vals_str = ", ".join(vals)
                sql_lines.append(f"INSERT INTO \"{table.name}\" ({cols_str}) VALUES ({vals_str});")

    sql_lines.append("\nCOMMIT;\n")
    return "\n".join(sql_lines).encode("utf-8")


def run_backup():
    now_str = datetime.datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"vahn_db_{now_str}.sql.gz"
    local_path = LOCAL_BACKUP_DIR / filename
    s3_key = f"database-backups/{filename}"

    print(f"============================================================")
    print(f" Starting VAHN Database Backup -> AWS S3")
    print(f" Target Bucket: s3://{AWS_BUCKET_NAME}/{s3_key}")
    print(f"============================================================")

    # 1. Generate SQL dump
    sql_bytes = dump_postgres_to_sql_bytes()
    compressed_bytes = gzip.compress(sql_bytes, compresslevel=9)

    # 2. Write local copy
    with open(local_path, "wb") as f:
        f.write(compressed_bytes)
    
    file_size_kb = round(len(compressed_bytes) / 1024, 2)
    print(f"✔ Compressed SQL backup written locally: {local_path} ({file_size_kb} KB)")

    # 3. Upload to AWS S3
    s3 = get_s3_client()
    s3.put_object(
        Bucket=AWS_BUCKET_NAME,
        Key=s3_key,
        Body=compressed_bytes,
        ContentType="application/gzip",
        Metadata={
            "created_at": datetime.datetime.utcnow().isoformat(),
            "uncompressed_bytes": str(len(sql_bytes)),
        }
    )
    print(f"✔ Successfully uploaded backup to AWS S3: s3://{AWS_BUCKET_NAME}/{s3_key}")
    print(f"✔ Location visible in AWS Console under: s3://{AWS_BUCKET_NAME}/database-backups/")

    # 4. Clean up local backups older than 7 days
    try:
        cutoff = datetime.datetime.now() - datetime.timedelta(days=7)
        for old_file in LOCAL_BACKUP_DIR.glob("vahn_db_*.sql.gz"):
            if datetime.datetime.fromtimestamp(old_file.stat().st_mtime) < cutoff:
                old_file.unlink()
                print(f"✔ Rotated old local backup: {old_file.name}")
    except Exception:
        pass

    print(f"============================================================")
    return {
        "filename": filename,
        "s3_key": s3_key,
        "size_kb": file_size_kb,
        "timestamp": now_str
    }


if __name__ == "__main__":
    try:
        run_backup()
    except Exception as e:
        print(f"✘ Backup failed: {e}", file=sys.stderr)
        sys.exit(1)
