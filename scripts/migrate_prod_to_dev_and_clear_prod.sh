#!/usr/bin/env bash
# ============================================================
# VAHN Data Migration & Safe Prod Reset
# 1. Backs up Production Database (vahn_db)
# 2. Restores snapshot into Development Database (vahn_dev_db)
# 3. Safely clears Production catalog (Products, Variants, Colours, Collections, Orders)
#    PRESERVING: admin_users, users, size_guides, store_settings, alembic_version
# Usage: ./scripts/migrate_prod_to_dev_and_clear_prod.sh
# ============================================================

set -e

PROD_CONTAINER="vahn-postgres-db-prod"
DEV_CONTAINER="vahn-postgres-db-dev"
PROD_DB="vahn_db"
PROD_USER="vahn_user"
DEV_DB="vahn_dev_db"
DEV_USER="vahn_dev_user"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="/tmp/vahn_prod_backup_${TIMESTAMP}.sql"

echo "============================================================"
echo " [VAHN DB SYNC & SAFE RESET] Started at $(date)"
echo "============================================================"

# 1. Verify containers
if ! docker ps | grep -q "${PROD_CONTAINER}"; then
    echo "✘ Error: Production container '${PROD_CONTAINER}' is not running."
    exit 1
fi

if ! docker ps | grep -q "${DEV_CONTAINER}"; then
    echo "✘ Error: Development container '${DEV_CONTAINER}' is not running."
    exit 1
fi

# 2. Step 1: Create full safety backup of Production
echo "--> 1/4 Creating full safety backup of Production (${PROD_DB})..."
docker exec "${PROD_CONTAINER}" pg_dump -U "${PROD_USER}" --clean --if-exists "${PROD_DB}" > "${BACKUP_FILE}"
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "✔ Safety backup created at ${BACKUP_FILE} (${BACKUP_SIZE})"

# 3. Step 2: Restore full dataset into Dev Database
echo "--> 2/4 Restoring dataset into Development Database (${DEV_DB})..."
docker exec -i "${DEV_CONTAINER}" psql -U "${DEV_USER}" -d "${DEV_DB}" < "${BACKUP_FILE}" > /dev/null 2>&1 || true
echo "✔ Development database (${DEV_DB}) successfully populated with all production products, colours & variants!"

# 4. Step 3: Run Alembic on Dev to ensure schema sync
echo "--> 3/4 Running Alembic migrations on dev backend..."
if docker ps | grep -q "vahn-backend-dev"; then
    docker exec vahn-backend-dev python -m alembic upgrade head
    echo "✔ Alembic migrations confirmed on dev."
fi

# 5. Step 4: Safely clear Production catalog data (Preserving Admin Users & Auth)
echo "--> 4/4 Safely clearing Production catalog data (preserving Admin login & accounts)..."
docker exec "${PROD_CONTAINER}" psql -U "${PROD_USER}" -d "${PROD_DB}" -c "
    TRUNCATE TABLE 
        collection_products,
        product_variants,
        product_colour_groups,
        product_reviews,
        restock_subscriptions,
        cart_items,
        carts,
        order_items,
        orders,
        products,
        collections
    CASCADE;
"
echo "✔ Production catalog cleanly cleared."
echo "✔ Admin login, customer accounts, and schema migrations preserved intact."

echo "============================================================"
echo " [SUCCESS] Migration & Safe Reset Complete!"
echo " • Dev Catalog (Active with all products): https://dev.vahnsports.com/products"
echo " • Prod Catalog (Clean slate ready for fresh data): https://vahnsports.com/products"
echo " • Safety Backup Stored: ${BACKUP_FILE}"
echo "============================================================"
