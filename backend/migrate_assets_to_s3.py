"""
Asset Migration Script: UploadThing & External Media -> AWS S3 (Bucket: vahn, Region: ap-south-2)
Scans database for product images, colour groups, lookbooks, size guides, and collections,
downloads them, uploads to S3, and updates Neon PostgreSQL with the new S3 URLs.
"""
import os
import sys
import json
import urllib.request
import mimetypes
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from database import SessionLocal
import models
from storage import storage, sanitize_filename

db = SessionLocal()

print("=" * 60)
print(f"Starting Asset Migration to S3 Bucket: {storage.bucket} ({storage.region})")
print("=" * 60)

s3 = storage._get_client()

def is_s3_url(url: str) -> bool:
    if not url:
        return True
    return f"{storage.bucket}.s3.{storage.region}.amazonaws.com" in url or f"s3.{storage.region}.amazonaws.com/{storage.bucket}" in url

def migrate_single_url(url: str, folder: str = "products") -> str:
    """Downloads an image from url and uploads to S3, returning new S3 URL."""
    if not url or not url.startswith("http"):
        return url
    if is_s3_url(url):
        return url

    try:
        print(f"  [Downloading] {url[:70]}...")
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
            content_type = resp.headers.get_content_type() or "image/jpeg"

        # Determine file extension
        ext = mimetypes.guess_extension(content_type) or ".jpg"
        if ext == ".jpe":
            ext = ".jpg"
        base_name = f"asset{ext}"

        key = storage.generate_key(base_name, folder=folder)
        new_url = storage.upload_file_bytes(data, key, content_type)
        print(f"  -> [Uploaded to S3] {new_url}")
        return new_url
    except Exception as e:
        print(f"  [WARN] Failed to migrate URL {url}: {e}")
        return url


def run_migration():
    total_migrated = 0

    # 1. Migrate Products
    products = db.query(models.Product).all()
    print(f"\nScanning {len(products)} products...")
    for prod in products:
        updated = False

        # Featured image
        if prod.featured_image_url and not is_s3_url(prod.featured_image_url):
            new_feat = migrate_single_url(prod.featured_image_url, folder="products")
            if new_feat != prod.featured_image_url:
                prod.featured_image_url = new_feat
                updated = True
                total_migrated += 1

        # Product images gallery
        if prod.images and isinstance(prod.images, list):
            new_images = []
            for img in prod.images:
                if isinstance(img, dict) and "url" in img:
                    orig_url = img.get("url", "")
                    if orig_url and not is_s3_url(orig_url):
                        new_u = migrate_single_url(orig_url, folder="products")
                        if new_u != orig_url:
                            img["url"] = new_u
                            updated = True
                            total_migrated += 1
                    new_images.append(img)
                else:
                    new_images.append(img)
            if updated:
                prod.images = new_images

        # Lookbook cards
        if prod.lookbook and isinstance(prod.lookbook, list):
            new_lookbook = []
            for item in prod.lookbook:
                if isinstance(item, dict) and "imageUrl" in item:
                    orig_url = item.get("imageUrl", "")
                    if orig_url and not is_s3_url(orig_url):
                        new_u = migrate_single_url(orig_url, folder="lookbook")
                        if new_u != orig_url:
                            item["imageUrl"] = new_u
                            updated = True
                            total_migrated += 1
                    new_lookbook.append(item)
                else:
                    new_lookbook.append(item)
            if updated:
                prod.lookbook = new_lookbook

        if updated:
            db.add(prod)

    # 2. Migrate Colour Groups
    groups = db.query(models.ProductColourGroup).all()
    print(f"\nScanning {len(groups)} colour groups...")
    for g in groups:
        updated = False
        if g.images and isinstance(g.images, list):
            new_imgs = []
            for img in g.images:
                if isinstance(img, dict) and "url" in img:
                    orig_url = img.get("url", "")
                    if orig_url and not is_s3_url(orig_url):
                        new_u = migrate_single_url(orig_url, folder="products")
                        if new_u != orig_url:
                            img["url"] = new_u
                            updated = True
                            total_migrated += 1
                    new_imgs.append(img)
                else:
                    new_imgs.append(img)
            if updated:
                g.images = new_imgs
                db.add(g)

    # 3. Migrate Size Guides
    size_guides = db.query(models.SizeGuideType).all()
    print(f"\nScanning {len(size_guides)} size guides...")
    for sg in size_guides:
        if sg.diagram_image_url and not is_s3_url(sg.diagram_image_url):
            new_u = migrate_single_url(sg.diagram_image_url, folder="size-guides")
            if new_u != sg.diagram_image_url:
                sg.diagram_image_url = new_u
                db.add(sg)
                total_migrated += 1

    # 4. Migrate Collections
    collections = db.query(models.Collection).all()
    print(f"\nScanning {len(collections)} collections...")
    for col in collections:
        if col.image_url and not is_s3_url(col.image_url):
            new_u = migrate_single_url(col.image_url, folder="collections")
            if new_u != col.image_url:
                col.image_url = new_u
                db.add(col)
                total_migrated += 1

    # 5. Migrate Media Assets
    assets = db.query(models.MediaAsset).all()
    print(f"\nScanning {len(assets)} media assets...")
    for ast in assets:
        if ast.url and not is_s3_url(ast.url):
            new_u = migrate_single_url(ast.url, folder="media")
            if new_u != ast.url:
                ast.url = new_u
                ast.provider = "s3"
                db.add(ast)
                total_migrated += 1

    db.commit()
    print("=" * 60)
    print(f"[SUCCESS] Migration completed! Migrated {total_migrated} assets to Amazon S3.")
    print("=" * 60)

if __name__ == "__main__":
    run_migration()
