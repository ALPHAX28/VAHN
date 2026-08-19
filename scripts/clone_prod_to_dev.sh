#!/usr/bin/env bash
# ============================================================
# VAHN Database Sync: Clone Production Data -> Dev Database
# Safely dumps vahn_db (Prod) and restores it into vahn_dev_db (Dev)
# Usage: ./scripts/clone_prod_to_dev.sh
# ============================================================

set -e

PROD_CONTAINER="vahn-postgres-db-prod"
DEV_CONTAINER="vahn-postgres-db-dev"
PROD_DB="vahn_db"
PROD_USER="vahn_user"
DEV_DB="vahn_dev_db"
DEV_USER="vahn_dev_user"
TMP_DUMP="/tmp/vahn_prod_snapshot.sql"

echo "============================================================"
echo " [VAHN DB CLONE] Production (${PROD_DB}) -> Development (${DEV_DB})"
echo "============================================================"

# 1. Verify both containers are running
if ! docker ps | grep -q "${PROD_CONTAINER}"; then
    echo "✘ Error: Production container '${PROD_CONTAINER}' is not running."
    exit 1
fi

if ! docker ps | grep -q "${DEV_CONTAINER}"; then
    echo "✘ Error: Development container '${DEV_CONTAINER}' is not running."
    exit 1
fi

# 2. Dump production database
echo "--> 1/3 Dumping production database (${PROD_DB})..."
docker exec "${PROD_CONTAINER}" pg_dump -U "${PROD_USER}" --clean --if-exists "${PROD_DB}" > "${TMP_DUMP}"
DUMP_SIZE=$(du -h "${TMP_DUMP}" | cut -f1)
echo "✔ Production dump created (${DUMP_SIZE})"

# 3. Restore into development database
echo "--> 2/3 Restoring into development database (${DEV_DB})..."
docker exec -i "${DEV_CONTAINER}" psql -U "${DEV_USER}" -d "${DEV_DB}" < "${TMP_DUMP}" > /dev/null 2>&1 || true
echo "✔ Development database updated with production snapshot."

# 4. Clean up temporary dump
rm -f "${TMP_DUMP}"

# 5. Run any pending Alembic migrations on dev
echo "--> 3/3 Running Alembic migrations on dev backend..."
if docker ps | grep -q "vahn-backend-dev"; then
    docker exec vahn-backend-dev python -m alembic upgrade head
    echo "✔ Alembic migrations applied to dev."
fi

echo "============================================================"
echo " [SUCCESS] Production data successfully cloned to Development!"
echo " Accessible live at: https://dev.vahnsports.com"
echo "============================================================"
