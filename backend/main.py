import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, selectinload

from database import Base, engine, get_db
import models
import schemas

import os

root_path = "/api/backend" if os.getenv("VERCEL") else ""
app = FastAPI(title="VAHN Standalone Backend API", root_path=root_path)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to convert DB model to schemas.ProductSchema
def db_product_to_schema(prod: models.Product) -> schemas.ProductSchema:
    # Convert variants
    variants_edges = []
    for v in prod.variants:
        variants_edges.append(
            schemas.VariantEdge(
                node=schemas.ProductVariant(
                    id=v.id,
                    title=v.title,
                    availableForSale=v.available_for_sale,
                    selectedOptions=[schemas.SelectedOption(**opt) for opt in v.selected_options],
                    price=schemas.Money(amount=f"{v.price_amount:.2f}", currencyCode=v.price_currency),
                    compareAtPrice=schemas.Money(amount=f"{v.compare_at_price_amount:.2f}", currencyCode=v.compare_at_price_currency) if v.compare_at_price_amount else None,
                    image=schemas.ImageNode(url=v.image_url, altText=v.title) if v.image_url else None,
                    quantityAvailable=v.inventory_quantity
                )
            )
        )
    
    # Convert options
    options_schemas = []
    for opt in prod.options:
        options_schemas.append(
            schemas.ProductOption(
                id=opt.get("id", ""),
                name=opt.get("name", ""),
                values=opt.get("values", [])
            )
        )

    # Convert images
    images_edges = []
    for img in prod.images:
        images_edges.append(
            schemas.ImageEdge(
                node=schemas.ImageNode(
                    url=img.get("url", ""),
                    altText=img.get("altText", "")
                )
            )
        )

    # Determine price ranges
    prices = [v.price_amount for v in prod.variants] if prod.variants else [0.0]
    min_price = min(prices)
    max_price = max(prices)
    currency = prod.variants[0].price_currency if prod.variants else "INR"

    compare_prices = [v.compare_at_price_amount for v in prod.variants if v.compare_at_price_amount]
    min_compare_price = min(compare_prices) if compare_prices else min_price

    lookbook_schemas = [
        schemas.LookbookSchema(
            id=item.get("id", ""),
            imageUrl=item.get("imageUrl", ""),
            title=item.get("title", ""),
            description=item.get("description", "")
        )
        for item in (prod.lookbook or [])
    ]

    review_schemas = [
        schemas.ReviewSchema(
            id=str(r.id),
            rating=r.rating,
            title=r.title,
            author=r.author,
            date=r.date,
            content=r.content,
            verified=r.verified
        )
        for r in (prod.reviews or [])
    ]

    return schemas.ProductSchema(
        id=f"gid://shopify/Product/{prod.id}",
        title=prod.title,
        handle=prod.handle,
        description=prod.description or "",
        descriptionHtml=prod.description_html or "",
        vendor=prod.vendor,
        productType=prod.product_type or "",
        tags=prod.tags or [],
        availableForSale=prod.available_for_sale,
        options=options_schemas,
        priceRange=schemas.PriceRange(
            minVariantPrice=schemas.Money(amount=f"{min_price:.2f}", currencyCode=currency),
            maxVariantPrice=schemas.Money(amount=f"{max_price:.2f}", currencyCode=currency)
        ),
        compareAtPriceRange=schemas.CompareAtPriceRange(
            minVariantPrice=schemas.Money(amount=f"{min_compare_price:.2f}", currencyCode=currency)
        ),
        images=schemas.ImagesConnection(edges=images_edges),
        variants=schemas.VariantsConnection(edges=variants_edges),
        seo=schemas.SEO(title=prod.title, description=prod.description),
        featuredImage=schemas.ImageNode(url=prod.featured_image_url, altText=prod.featured_image_alt) if prod.featured_image_url else None,
        lookbook=lookbook_schemas,
        reviews=review_schemas
    )

# ---- ENDPOINTS ----

@app.get("/")
def read_root():
    return {"status": "ok", "service": "VAHN Backend API"}

@app.get("/api")
def read_api_root():
    return {"status": "ok", "service": "VAHN Backend API"}

@app.get("/api/products", response_model=List[schemas.ProductSchema])
def list_products(db: Session = Depends(get_db)):
    products = db.query(models.Product).options(
        selectinload(models.Product.variants),
        selectinload(models.Product.reviews)
    ).filter_by(available_for_sale=True).all()
    return [db_product_to_schema(p) for p in products]

@app.get("/api/products/{handle}", response_model=schemas.ProductSchema)
def get_product(handle: str, db: Session = Depends(get_db)):
    prod = db.query(models.Product).options(
        selectinload(models.Product.variants),
        selectinload(models.Product.reviews)
    ).filter_by(handle=handle).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product_to_schema(prod)

@app.post("/api/products/{handle}/reviews", response_model=schemas.ReviewSchema)
def create_review(handle: str, review_in: schemas.ReviewCreate, db: Session = Depends(get_db)):
    prod = db.query(models.Product).filter_by(handle=handle).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    
    current_date = datetime.now().strftime("%d/%m/%Y")
    
    db_review = models.ProductReview(
        product_id=prod.id,
        rating=review_in.rating,
        title=review_in.title,
        author=review_in.author,
        date=current_date,
        content=review_in.content,
        verified=True
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    
    return schemas.ReviewSchema(
        id=str(db_review.id),
        rating=db_review.rating,
        title=db_review.title,
        author=db_review.author,
        date=db_review.date,
        content=db_review.content,
        verified=db_review.verified
    )

@app.get("/api/collections/{handle}", response_model=schemas.CollectionSchema)
def get_collection(handle: str, db: Session = Depends(get_db)):
    coll = db.query(models.Collection).options(
        selectinload(models.Collection.products).selectinload(models.Product.variants),
        selectinload(models.Collection.products).selectinload(models.Product.reviews)
    ).filter_by(handle=handle).first()
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Map products
    product_edges = []
    for idx, p in enumerate(coll.products):
        product_edges.append(
            schemas.ProductEdge(
                node=db_product_to_schema(p),
                cursor=f"cursor-{idx+1}"
            )
        )

    return schemas.CollectionSchema(
        id=f"gid://shopify/Collection/{coll.id}",
        handle=coll.handle,
        title=coll.title,
        description=coll.description or "",
        descriptionHtml=coll.description_html or "",
        image=schemas.ImageNode(url=coll.image_url, altText=coll.image_alt) if coll.image_url else None,
        seo=schemas.SEO(title=coll.title, description=coll.description),
        products=schemas.CollectionProductsConnection(
            edges=product_edges,
            pageInfo=schemas.PageInfo(hasNextPage=False, endCursor=f"cursor-{len(product_edges)}" if product_edges else None)
        )
    )

# ---- CART ENDPOINTS ----

def build_cart_schema(cart: models.Cart, db: Session) -> schemas.CartSchema:
    line_edges = []
    total_qty = 0
    subtotal = 0.0
    currency = "INR"

    for item in cart.items:
        v = item.variant
        p = v.product
        total_qty += item.quantity
        subtotal += v.price_amount * item.quantity
        currency = v.price_currency

        line_edges.append(
            schemas.CartLineEdge(
                node=schemas.CartLine(
                    id=item.id,
                    quantity=item.quantity,
                    merchandise=schemas.CartMerchandise(
                        id=v.id,
                        title=v.title,
                        price=schemas.Money(amount=f"{v.price_amount:.2f}", currencyCode=v.price_currency),
                        selectedOptions=[schemas.SelectedOption(**opt) for opt in v.selected_options],
                        product=schemas.CartProductMini(
                            id=f"gid://shopify/Product/{p.id}",
                            title=p.title,
                            handle=p.handle,
                            featuredImage=schemas.ImageNode(url=p.featured_image_url, altText=p.featured_image_alt) if p.featured_image_url else None
                        ),
                        quantityAvailable=v.inventory_quantity
                    ),
                    cost=schemas.CartLineCost(
                        totalAmount=schemas.Money(amount=f"{v.price_amount * item.quantity:.2f}", currencyCode=v.price_currency)
                    )
                )
            )
        )

    return schemas.CartSchema(
        id=cart.id,
        totalQuantity=total_qty,
        lines=schemas.CartLinesConnection(edges=line_edges),
        cost=schemas.CartCost(
            subtotalAmount=schemas.Money(amount=f"{subtotal:.2f}", currencyCode=currency),
            totalAmount=schemas.Money(amount=f"{subtotal:.2f}", currencyCode=currency),
            totalTaxAmount=schemas.Money(amount="0.00", currencyCode=currency)
        )
    )

@app.post("/api/cart", response_model=schemas.CartSchema)
def create_cart(lines: List[dict] = [], db: Session = Depends(get_db)):
    cart_id = str(uuid.uuid4())
    cart = models.Cart(id=cart_id)
    db.add(cart)
    db.commit()

    # If initial items are provided
    for line in lines:
        variant_id = line.get("merchandiseId")
        qty = line.get("quantity", 1)
        
        variant = db.query(models.ProductVariant).filter_by(id=variant_id).first()
        if variant:
            item = models.CartItem(
                id=str(uuid.uuid4()),
                cart_id=cart_id,
                variant_id=variant_id,
                quantity=qty
            )
            db.add(item)
    
    db.commit()
    db.refresh(cart)
    return build_cart_schema(cart, db)

@app.get("/api/cart/{cart_id}", response_model=schemas.CartSchema)
def get_cart(cart_id: str, db: Session = Depends(get_db)):
    cart = db.query(models.Cart).filter_by(id=cart_id).first()
    if not cart:
        # Create it on demand to prevent UI errors
        cart = models.Cart(id=cart_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return build_cart_schema(cart, db)

@app.post("/api/cart/{cart_id}/items", response_model=schemas.CartSchema)
def add_to_cart(cart_id: str, payload: dict, db: Session = Depends(get_db)):
    cart = db.query(models.Cart).filter_by(id=cart_id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    variant_id = payload.get("merchandiseId")
    qty = payload.get("quantity", 1)

    # Check if variant exists
    variant = db.query(models.ProductVariant).filter_by(id=variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    # Check if item already in cart
    item = db.query(models.CartItem).filter_by(cart_id=cart_id, variant_id=variant_id).first()
    if item:
        item.quantity += qty
    else:
        item = models.CartItem(
            id=str(uuid.uuid4()),
            cart_id=cart_id,
            variant_id=variant_id,
            quantity=qty
        )
        db.add(item)

    db.commit()
    db.refresh(cart)
    return build_cart_schema(cart, db)

@app.put("/api/cart/{cart_id}/items/{item_id}", response_model=schemas.CartSchema)
def update_cart_item(cart_id: str, item_id: str, payload: dict, db: Session = Depends(get_db)):
    cart = db.query(models.Cart).filter_by(id=cart_id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    item = db.query(models.CartItem).filter_by(id=item_id, cart_id=cart_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    qty = payload.get("quantity", 1)
    if qty <= 0:
        db.delete(item)
    else:
        item.quantity = qty

    db.commit()
    db.refresh(cart)
    return build_cart_schema(cart, db)

@app.delete("/api/cart/{cart_id}/items/{item_id}", response_model=schemas.CartSchema)
def remove_cart_item(cart_id: str, item_id: str, db: Session = Depends(get_db)):
    cart = db.query(models.Cart).filter_by(id=cart_id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    item = db.query(models.CartItem).filter_by(id=item_id, cart_id=cart_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    db.delete(item)
    db.commit()
    db.refresh(cart)
    return build_cart_schema(cart, db)
