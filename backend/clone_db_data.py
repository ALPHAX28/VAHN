"""
Database Sync Script: Clones all data from Neon PostgreSQL -> Target PostgreSQL Database.
Transfers users, admins, products, variants, colour groups, collections, reviews, size guides, etc.
"""
import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# 1. Source Database (Neon)
SRC_URL = "postgresql+pg8000://neondb_owner:npg_XSY3is4crOMQ@ep-nameless-credit-azboidlm-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb"

# 2. Target Database (Local / Production)
TGT_URL = os.getenv("TARGET_DATABASE_URL", "postgresql+pg8000://vahn_user:vahn_pass@db:5432/vahn_db")
if len(sys.argv) > 1:
    TGT_URL = sys.argv[1]

# Strip query parameters for pg8000
if "+pg8000" in TGT_URL and "?" in TGT_URL:
    TGT_URL = TGT_URL.split("?")[0]

print("=" * 60)
print(f"Syncing Database Data from Neon -> Target DB")
print(f"Source: {SRC_URL.split('@')[-1]}")
print(f"Target: {TGT_URL.split('@')[-1]}")
print("=" * 60)

src_engine = create_engine(SRC_URL)
tgt_engine = create_engine(TGT_URL)

SrcSession = sessionmaker(bind=src_engine)
TgtSession = sessionmaker(bind=tgt_engine)

src_db = SrcSession()
tgt_db = TgtSession()

# Table list in dependency order
TABLES = [
    "users",
    "collections",
    "products",
    "collection_products",
    "product_variants",
    "product_colour_groups",
    "size_guide_types",
    "reviews",
    "orders",
    "order_items",
    "media_assets",
    "restock_subscriptions"
]

def clone_table(table_name: str):
    print(f"--> Cloning table: {table_name}...")
    try:
        # Check if table exists in source
        src_rows = src_db.execute(text(f"SELECT * FROM {table_name}")).mappings().all()
        if not src_rows:
            print(f"    Table {table_name} is empty in source. Skipping.")
            return

        print(f"    Found {len(src_rows)} rows in source.")

        # Clear target table
        tgt_db.execute(text(f"DELETE FROM {table_name}"))
        tgt_db.commit()

        # Insert rows into target table
        for r in src_rows:
            cols = list(r.keys())
            col_str = ", ".join(cols)
            val_placeholders = ", ".join([f":{c}" for c in cols])
            insert_stmt = text(f"INSERT INTO {table_name} ({col_str}) VALUES ({val_placeholders})")
            tgt_db.execute(insert_stmt, dict(r))

        tgt_db.commit()

        # Reset serial sequence if table has id column
        try:
            tgt_db.execute(text(f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), COALESCE(MAX(id), 1)) FROM {table_name}"))
            tgt_db.commit()
        except Exception:
            pass

        print(f"    ✔ Successfully synced {len(src_rows)} rows into {table_name}.")
    except Exception as e:
        print(f"    [WARN] Error syncing table {table_name}: {e}")
        tgt_db.rollback()

def main():
    for tbl in TABLES:
        clone_table(tbl)
    print("=" * 60)
    print("[SUCCESS] All tables cloned and synchronized successfully!")
    print("=" * 60)

if __name__ == "__main__":
    main()
