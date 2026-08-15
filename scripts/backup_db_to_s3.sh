#!/usr/bin/env bash
# ============================================================
# VAHN Automated Database Backup Engine -> Amazon S3
# Dumps PostgreSQL from Docker container, compresses, and uploads to S3
# Run via cron every 1 hour
# ============================================================

set -e

BACKUP_DIR="/home/ubuntu/backups/db"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILENAME="vahn_db_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
S3_BUCKET="s3://vahn/database-backups"
LOG_FILE="/var/log/vahn_db_backup.log"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting automated database backup..." >> "${LOG_FILE}"

# 1. Dump & compress from PostgreSQL Docker container
if docker exec vahn-postgres-db-prod pg_dump -U vahn_user -d vahn_db | gzip -9 > "${BACKUP_PATH}"; then
    FILE_SIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
    echo "[$(date)] ✔ Database dumped successfully (${FILE_SIZE})" >> "${LOG_FILE}"
else
    echo "[$(date)] ✘ ERROR: pg_dump failed!" >> "${LOG_FILE}"
    exit 1
fi

# 2. Upload to Amazon S3
if aws s3 cp "${BACKUP_PATH}" "${S3_BUCKET}/${BACKUP_FILENAME}" --region ap-south-2; then
    echo "[$(date)] ✔ Uploaded to ${S3_BUCKET}/${BACKUP_FILENAME}" >> "${LOG_FILE}"
else
    echo "[$(date)] ✘ ERROR: AWS S3 upload failed!" >> "${LOG_FILE}"
    exit 1
fi

# 3. Clean up local backups older than 7 days
find "${BACKUP_DIR}" -type f -name "vahn_db_*.sql.gz" -mtime +7 -delete
echo "[$(date)] ✔ Backup rotation complete (local 7-day retention preserved)." >> "${LOG_FILE}"
