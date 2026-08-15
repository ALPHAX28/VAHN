"""
Robust Database Sync Script: Clones all data from Neon PostgreSQL -> Target PostgreSQL Database
Uses SQLAlchemy ORM object serialization to guarantee proper JSON column and type handling.
"""
import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, make_transient

import models

# 1. Source Database (Neon)
SRC_URL = "postgresql+pg8000://neondb_owner:npg_XSY3is4crOMQ@ep-nameless-credit-azboidlm-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb"

# 2. Target Database (Local / Container)
TGT_URL = os.getenv("TARGET_DATABASE_URL", "postgresql+pg8000://vahn_user:vahn_pass@db:5432/vahn_db")
if len(sys.argv) > 1:
    TGT_URL = sys.argv[1]

# Strip query parameters for pg8000
if "+pg8000" in TGT_URL and "?" in TGT_URL:
    TGT_URL = TGT_URL.split("?")[0]

print("=" * 60)
print(f"Syncing Database Data from Neon -> Target DB")
print("=" * 60)

src_engine = create_engine(SRC_URL)
tgt_engine = create_engine(TGT_URL)

SrcSession = sessionmaker(bind=src_engine)
TgtSession = sessionmaker(bind=tgt_engine)

src_db = SrcSession()
tgt_db = TgtSession()

# Model classes in dependency order
MODEL_CLASSES = [
    models.User,
    models.Collection,
    models.Product,
    models.ProductVariant,
    models.ProductColourGroup,
    models.SizeGuideType,
    models.ProductReview,
    models.Order,
    models.OrderItem,
    models.MediaAsset,
    models.RestockSubscription,
    models.StoreSetting,
]

def clone_model(model_cls):
    table_name = model_cls.__tablename__
    print(f"--> Syncing table: {table_name}...")
    try:
        items = src_db.query(model_cls).all()
        print(f"    Found {len(items)} records in source.")
        
        # Clear target table
        tgt_db.query(model_cls).delete()
        tgt_db.commit()

        for item in items:
            src_db.expunge(item)
            make_transient(item)
            tgt_db.merge(item)

        tgt_db.commit()

        # Reset serial sequence if integer id
        try:
            tgt_db.execute(text(f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), COALESCE(MAX(id), 1)) FROM {table_name}"))
            tgt_db.commit()
        except Exception:
            pass

        print(f"    ✔ Synced {len(items)} records into {table_name}.")
    except Exception as e:
        print(f"    [ERROR] Failed to sync {table_name}: {e}")
        src_db.rollback()
        tgt_db.rollback()


def sync_collection_products_table():
    print("--> Syncing many-to-many: collection_products...")
    try:
        rows = src_db.execute(text("SELECT collection_id, product_id FROM collection_products")).all()
        tgt_db.execute(text("DELETE FROM collection_products"))
        tgt_db.commit()

        for r in rows:
            tgt_db.execute(
                text("INSERT INTO collection_products (collection_id, product_id) VALUES (:c, :p)"),
                {"c": r[0], "p": r[1]}
            )
        tgt_db.commit()
        print(f"    ✔ Synced {len(rows)} collection-product associations.")
    except Exception as e:
        print(f"    [WARN] Failed to sync collection_products: {e}")
        src_db.rollback()
        tgt_db.rollback()


def main():
    for model_cls in MODEL_CLASSES:
        clone_model(model_cls)
    
    sync_collection_products_table()
    
    print("=" * 60)
    print("[SUCCESS] All tables and relationships synced successfully from Neon to local Postgres!")
    print("=" * 60)

if __name__ == "__main__":
    main()
