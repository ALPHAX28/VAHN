import json
from sqlalchemy.orm import Session
from database import engine, SessionLocal
import models

def seed_database():
    db = SessionLocal()
    try:
        # Check if collection already exists
        db_collection = db.query(models.Collection).filter_by(handle="vahn-beginning").first()
        if not db_collection:
            print("Creating 'Vahn Beginning' collection...")
            db_collection = models.Collection(
                title="Vahn Beginning",
                handle="vahn-beginning",
                description="The debut bespoke teamwear collection from VAHN.",
                description_html="<p>The debut bespoke teamwear collection from VAHN.</p>",
                image_url="/assets/bull-banner.png",
                image_alt="Vahn Beginning Collection Banner"
            )
            db.add(db_collection)
            db.commit()
            db.refresh(db_collection)

        images_json = [
            {"url": "/assets/courtyard-jersey.png", "altText": "VAHN Signature Oversized Jersey - Front View"},
            {"url": "/assets/signature-product.png", "altText": "VAHN Signature Oversized Jersey - Detail View"},
            {"url": "/assets/bull-banner.png", "altText": "VAHN Signature Oversized Jersey - Lifestyle View"},
            {"url": "/assets/courtyard-jersey.png", "altText": "VAHN Signature Oversized Jersey - Back View"},
            {"url": "/assets/signature-product.png", "altText": "VAHN Signature Oversized Jersey - Texture View"},
            {"url": "/assets/bull-banner.png", "altText": "VAHN Signature Oversized Jersey - Editorial View"},
            {"url": "/assets/courtyard-jersey.png", "altText": "VAHN Signature Oversized Jersey - Close-up View"}
        ]

        # Check if product already exists
        db_product = db.query(models.Product).filter_by(handle="vahn-signature-oversized-jersey").first()
        if db_product:
            db_product.fit = "OVERSIZED"
            db_product.kit_type = "SIGNATURE"
            db_product.activity = "LIFESTYLE"
            db_product.images = images_json
            db.commit()
            print("Updated existing product with images, fit, kit_type, and activity attributes.")
        else:
            print("Creating 'VAHN Signature Oversized Jersey' product...")
            
            # Options and images JSON structures
            colours = ["Maroon", "Navy", "Black"]
            sizes = ["S", "M", "L", "XL"]
            
            options_json = [
                {"id": "opt-colour", "name": "Colour", "values": colours},
                {"id": "opt-size", "name": "Size", "values": sizes}
            ]
            
            images_json = [
                {"url": "/assets/courtyard-jersey.png", "altText": "VAHN Signature Oversized Jersey - Front View"},
                {"url": "/assets/signature-product.png", "altText": "VAHN Signature Oversized Jersey - Detail View"},
                {"url": "/assets/bull-banner.png", "altText": "VAHN Signature Oversized Jersey - Lifestyle View"}
            ]

            lookbook_json = [
                {
                    "id": "look-1",
                    "imageUrl": "/assets/courtyard-jersey.png",
                    "title": "The Weekend Daily",
                    "description": "Wide-leg denim, cotton tee, tote bag"
                },
                {
                    "id": "look-2",
                    "imageUrl": "/assets/bull-banner.png",
                    "title": "The Off-Day Fit",
                    "description": "Linen shorts, open shirt, white socks"
                },
                {
                    "id": "look-3",
                    "imageUrl": "/assets/signature-product.png",
                    "title": "The Creative Profile",
                    "description": "Cropped trousers, knit polo, messenger bag"
                },
                {
                    "id": "look-4",
                    "imageUrl": "/assets/courtyard-jersey.png",
                    "title": "The After-Hours Fit",
                    "description": "Loose fit trousers, oversized blazer, sneakers"
                }
            ]

            db_product = models.Product(
                title="VAHN Signature Oversized Jersey",
                handle="vahn-signature-oversized-jersey",
                description="Made with care and unconditionally loved by our customers, this signature bestseller exceeds all expectations. Crafted from premium heavyweight organic cotton blend fabric with a bespoke oversized fit, designed to transition from the training field to the street.",
                description_html="<p>Made with care and unconditionally loved by our customers, this signature bestseller exceeds all expectations. Crafted from premium heavyweight organic cotton blend fabric with a bespoke oversized fit, designed to transition from the training field to the street.</p><ul><li>Heavyweight 360gsm organic cotton blend</li><li>Bespoke relaxed oversized silhouette</li><li>Signature embroidered branding on chest</li><li>Ribbed crewneck collar</li></ul>",
                vendor="VAHN",
                product_type="Jersey",
                tags=["bestseller", "jersey", "signature"],
                available_for_sale=True,
                options=options_json,
                featured_image_url="/assets/courtyard-jersey.png",
                featured_image_alt="VAHN Signature Oversized Jersey",
                images=images_json,
                lookbook=lookbook_json,
                fit="OVERSIZED",
                kit_type="SIGNATURE",
                activity="LIFESTYLE"
            )
            db.add(db_product)
            db.commit()
            db.refresh(db_product)

            # Associate collection and product
            if db_product not in db_collection.products:
                db_collection.products.append(db_product)
                db.commit()

            # Create variants
            print("Creating variants for product...")
            variant_id_counter = 1
            for colour in colours:
                for size in sizes:
                    variant_id = f"gid://shopify/ProductVariant/mock-{variant_id_counter}"
                    variant_id_counter += 1
                    
                    variant_image = "/assets/courtyard-jersey.png"
                    if colour == "Navy":
                        variant_image = "/assets/signature-product.png"
                    elif colour == "Black":
                        variant_image = "/assets/bull-banner.png"

                    qty = 2 if size == "S" else 15

                    db_variant = models.ProductVariant(
                        id=variant_id,
                        product_id=db_product.id,
                        title=f"{colour} / {size}",
                        available_for_sale=True,
                        price_amount=55.0,
                        price_currency="INR",
                        compare_at_price_amount=75.0,
                        compare_at_price_currency="INR",
                        image_url=variant_image,
                        inventory_quantity=qty,
                        selected_options=[
                            {"name": "Colour", "value": colour},
                            {"name": "Size", "value": size}
                        ]
                    )
                    db.add(db_variant)
            
            # Create mock reviews
            print("Creating mock reviews...")
            mock_reviews = [
                {
                    "author": "Anonymous",
                    "rating": 5.0,
                    "title": "Very comfy",
                    "date": "01/06/2026",
                    "content": "very comfortable",
                    "verified": True
                },
                {
                    "author": "Agastya Das",
                    "rating": 5.0,
                    "title": "Undisputedly Beautiful",
                    "date": "27/05/2026",
                    "content": "Great comfort , design is undisputedly Beautiful. Worth it.",
                    "verified": True
                },
                {
                    "author": "Arjun",
                    "rating": 5.0,
                    "title": "Extremely comfortable",
                    "date": "19/05/2026",
                    "content": "They are incredible. Love them. Extremely comfortable. Looks real nice. For me perfect. Loving Gully Labs.",
                    "verified": True
                },
                {
                    "author": "Santosh Chand",
                    "rating": 5.0,
                    "title": "Proud of Indian Brand",
                    "date": "30/04/2026",
                    "content": "Loved it. Proud of Indian brand in finally making something good",
                    "verified": True
                },
                {
                    "author": "Vaibhav Kadam",
                    "rating": 5.0,
                    "title": "Best pair!!",
                    "date": "26/04/2026",
                    "content": "Best pair!!",
                    "verified": True
                },
                {
                    "author": "Hemanshu Hegde",
                    "rating": 5.0,
                    "title": "Perfect fit",
                    "date": "21/04/2026",
                    "content": "Super comfortable and stylish. The fit is perfect.",
                    "verified": True
                },
                {
                    "author": "Riday Thakur",
                    "rating": 4.0,
                    "title": "Very Nice Shoes",
                    "date": "15/04/2026",
                    "content": "Really liked these shoes. The color combination looks classy and matches with most outfits. The fit is true to size and they're comfortable even after wearing for long hours.",
                    "verified": True
                },
                {
                    "author": "Ketan Gupta",
                    "rating": 4.0,
                    "title": "Good Quality",
                    "date": "10/04/2026",
                    "content": "The quality feels premium and the packaging was nice too. Overall, very happy with the purchase. Would definitely recommend VAHN.",
                    "verified": True
                },
                {
                    "author": "Aditya Sharma",
                    "rating": 3.0,
                    "title": "Average fit",
                    "date": "05/04/2026",
                    "content": "The shoes look great but they are a bit tight near the toes. Consider ordering one size larger.",
                    "verified": True
                },
                {
                    "author": "Rahul Verma",
                    "rating": 5.0,
                    "title": "Amazing style",
                    "date": "01/04/2026",
                    "content": "Super stylish and goes well with both casual and semi-formal wear.",
                    "verified": True
                },
                {
                    "author": "Sneha Sen",
                    "rating": 5.0,
                    "title": "Love the design",
                    "date": "28/03/2026",
                    "content": "Simply gorgeous design. Got a lot of compliments already.",
                    "verified": True
                },
                {
                    "author": "Vikram Rao",
                    "rating": 4.0,
                    "title": "Comfortable",
                    "date": "25/03/2026",
                    "content": "Very comfortable for daily walking and running. Worth the price.",
                    "verified": True
                }
            ]

            for review_data in mock_reviews:
                db_review = models.ProductReview(
                    product_id=db_product.id,
                    rating=review_data["rating"],
                    title=review_data["title"],
                    author=review_data["author"],
                    date=review_data["date"],
                    content=review_data["content"],
                    verified=review_data["verified"]
                )
                db.add(db_review)

            db.commit()
            print("Seed complete.")
            
    except Exception as e:
        db.rollback()
        print("Error seeding database:", e)
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
