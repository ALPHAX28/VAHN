#!/usr/bin/env python3
"""
VAHN Automated Database Backup Engine -> Amazon S3
Connects to PostgreSQL, generates a compressed SQL dump, and uploads to AWS S3.
Can be executed manually or automatically via cron / scheduler / GitHub Actions.
Zero hard dependencies on external packages for bootstrap (dotenv / boto3 handled safely).
"""

import os
import sys
import gzip
import datetime
import subprocess
from pathlib import Path

# ─── 1. Load Environment Variables (Native & Dotenv Support) ─────────────────
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
ENV_PATH = BACKEND_DIR / ".env"

try:
    from dotenv import load_dotenv
    load_dotenv(ENV_PATH)
except ImportError:
    pass

# Manual fallback parser for .env if python-dotenv is not installed
if ENV_PATH.exists():
    try:
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k not in os.environ:
                        os.environ[k] = v
    except Exception as e:
        print(f"⚠ Warning: Could not read {ENV_PATH}: {e}")

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


# ─── 2. Database Dump Logic ──────────────────────────────────────────────────
def dump_postgres_to_sql_bytes() -> bytes:
    """Attempts pg_dump via docker, local pg_dump, or SQLAlchemy data extraction."""
    timestamp = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    
    # 1. Try Docker container pg_dump (Production or Dev container)
    for container_name in ["vahn-postgres-db-prod", "vahn-postgres-db", "vahn-postgres-db-dev", "nextjs-vahn-db-1"]:
        try:
            cmd = ["docker", "exec", container_name, "pg_dump", "-U", DB_USER, "-d", DB_NAME]
            proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            if proc.stdout and len(proc.stdout) > 50:
                print(f"✔ Dumped database via Docker container '{container_name}'")
                return proc.stdout
        except Exception:
            pass

    # 2. Try native pg_dump CLI
    try:
        env = os.environ.copy()
        if DB_PASSWORD:
            env["PGPASSWORD"] = DB_PASSWORD
        cmd = ["pg_dump", "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME]
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, check=True)
        if proc.stdout and len(proc.stdout) > 50:
            print("✔ Dumped database via native pg_dump CLI")
            return proc.stdout
    except Exception:
        pass

    # 3. Fallback: Python SQLAlchemy Extraction
    print("--> Using SQLAlchemy data extraction for SQL dump...")
    sys.path.insert(0, str(BACKEND_DIR))
    from sqlalchemy import create_engine, MetaData, select
    import json

    db_url = DATABASE_URL
    if "+pg8000" in db_url and "?" in db_url:
        db_url = db_url.split("?")[0]

    engine = create_engine(db_url)
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


# ─── 3. S3 Upload Logic ──────────────────────────────────────────────────────
def upload_bytes_to_s3(data: bytes, s3_key: str):
    """Uploads compressed bytes to AWS S3 using boto3 (auto-installed/imported)."""
    try:
        import boto3
    except ImportError:
        print("--> 'boto3' not found in current Python, attempting auto-installation...")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "boto3"], check=True)
            import boto3
        except Exception as e:
            print(f"⚠ Could not auto-install boto3: {e}")
            # Try docker container upload fallback
            print("--> Attempting S3 upload through docker container 'vahn-backend-prod'...")
            docker_cmd = [
                "docker", "exec", "-i", "vahn-backend-prod", "python", "-c",
                f"""
import sys, boto3
s3 = boto3.client('s3', region_name='{AWS_REGION}', aws_access_key_id='{AWS_ACCESS_KEY_ID}', aws_secret_access_key='{AWS_SECRET_ACCESS_KEY}')
s3.put_object(Bucket='{AWS_BUCKET_NAME}', Key='{s3_key}', Body=sys.stdin.buffer.read(), ContentType='application/gzip')
print('SUCCESS_DOCKER_S3')
"""
            ]
            proc = subprocess.run(docker_cmd, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            if b"SUCCESS_DOCKER_S3" in proc.stdout:
                return
            raise RuntimeError(f"Docker S3 upload failed: {proc.stderr.decode('utf-8')}")

    s3 = boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )
    s3.put_object(
        Bucket=AWS_BUCKET_NAME,
        Key=s3_key,
        Body=data,
        ContentType="application/gzip",
        Metadata={
            "created_at": datetime.datetime.utcnow().isoformat(),
        }
    )


# ─── 4. S3 Backup Rotation — Keep Latest N ───────────────────────────────────
def rotate_s3_backups(s3_client, keep: int = 3):
    """
    Lists all backups under database-backups/ in S3 and deletes all but the
    most-recent `keep` files.  Sorting is done on the filename timestamp so the
    newest files are always preserved regardless of S3 LastModified metadata.
    """
    try:
        paginator = s3_client.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=AWS_BUCKET_NAME, Prefix="database-backups/")

        all_items = []
        for page in pages:
            for obj in page.get("Contents", []):
                key = obj["Key"]
                # Only consider actual backup files, not the folder prefix itself
                if key.endswith(".sql.gz"):
                    all_items.append((obj["LastModified"], key))

        if len(all_items) <= keep:
            print(f"✔ S3 backup rotation: {len(all_items)} backup(s) found — nothing to prune (keeping {keep})")
            return

        # Sort chronologically by LastModified (oldest first, newest last)
        all_items.sort(key=lambda x: x[0])

        to_delete_items = all_items[: len(all_items) - keep]
        objects = [{"Key": k} for _, k in to_delete_items]

        s3_client.delete_objects(
            Bucket=AWS_BUCKET_NAME,
            Delete={"Objects": objects, "Quiet": True},
        )

        for _, k in to_delete_items:
            print(f"🗑  Rotated old S3 backup: {k.split('/')[-1]}")

        print(f"✔ S3 rotation complete: kept latest {keep}, deleted {len(to_delete_items)} old backup(s)")
    except Exception as exc:
        # Rotation failure is non-fatal — backup already uploaded successfully
        print(f"⚠ S3 rotation failed (non-fatal): {exc}")


# ─── 5. Main Runner ──────────────────────────────────────────────────────────
def run_backup():
    now_str = datetime.datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"vahn_db_{now_str}.sql.gz"
    local_path = LOCAL_BACKUP_DIR / filename
    s3_key = f"database-backups/{filename}"

    print("============================================================")
    print(" Starting VAHN Database Backup -> AWS S3")
    print(f" Target Bucket: s3://{AWS_BUCKET_NAME}/{s3_key}")
    print("============================================================")

    # 1. Generate SQL dump
    sql_bytes = dump_postgres_to_sql_bytes()
    compressed_bytes = gzip.compress(sql_bytes, compresslevel=9)

    # 2. Write local copy
    with open(local_path, "wb") as f:
        f.write(compressed_bytes)

    file_size_kb = round(len(compressed_bytes) / 1024, 2)
    print(f"✔ Compressed SQL backup written locally: {local_path} ({file_size_kb} KB)")

    # 3. Upload to AWS S3
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        try:
            import boto3
        except ImportError:
            subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "boto3"], check=True)
            import boto3

        s3_client = boto3.client(
            "s3",
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )

        s3_client.put_object(
            Bucket=AWS_BUCKET_NAME,
            Key=s3_key,
            Body=compressed_bytes,
            ContentType="application/gzip",
            Metadata={"created_at": datetime.datetime.utcnow().isoformat()},
        )
        print(f"✔ Successfully uploaded backup to AWS S3: s3://{AWS_BUCKET_NAME}/{s3_key}")
        print(f"✔ Location visible in AWS Console under: s3://{AWS_BUCKET_NAME}/database-backups/")

        # 4. Rotate S3 — keep only the latest 3 backups
        rotate_s3_backups(s3_client, keep=3)
    else:
        print("⚠ AWS S3 credentials not configured; local compressed backup saved.")

    # 5. Clean up local backups older than 7 days
    try:
        cutoff = datetime.datetime.now() - datetime.timedelta(days=7)
        for old_file in LOCAL_BACKUP_DIR.glob("vahn_db_*.sql.gz"):
            if datetime.datetime.fromtimestamp(old_file.stat().st_mtime) < cutoff:
                old_file.unlink()
                print(f"✔ Rotated old local backup: {old_file.name}")
    except Exception:
        pass

    print("============================================================")
    return {
        "filename": filename,
        "s3_key": s3_key,
        "size_kb": file_size_kb,
        "timestamp": now_str,
    }


if __name__ == "__main__":
    try:
        run_backup()
    except Exception as e:
        print(f"✘ Backup failed: {e}", file=sys.stderr)
        sys.exit(1)
