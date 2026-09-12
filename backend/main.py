import os
import re
import json
from dotenv import load_dotenv

# Ensure environment variables are loaded immediately
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(_env_path):
    load_dotenv(_env_path)
load_dotenv()

import secrets
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func

import database
from database import engine, get_db, SessionLocal
import models
import schemas
import razorpay_service
import shiprocket_service
import logging

logger = logging.getLogger(__name__)
from email_service import (
    send_otp_email, send_order_confirmation_email, send_restock_notification_email,
    send_account_suspended_email, send_account_reactivated_email, send_account_deleted_email,
    send_contact_inquiry_notification, send_contact_inquiry_receipt
)

from auth_utils import (
    create_access_token, get_current_user, get_optional_current_user, get_current_admin,
    create_otp_token, verify_otp_token, check_rate_limit, normalize_phone
)
from storage import storage

import asyncio
from contextlib import asynccontextmanager
import sqlalchemy

async def _db_heartbeat_loop():
    """Background task that runs every 3 minutes (180s) to keep DB connection pool warm while server is running."""
    while True:
        try:
            await asyncio.sleep(180)
            db = next(get_db())
            try:
                db.execute(sqlalchemy.text("SELECT 1"))
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception:
            pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    heartbeat_task = asyncio.create_task(_db_heartbeat_loop())
    try:
        from sqlalchemy import text
        with database.SessionLocal() as s:
            s.execute(text("UPDATE products SET shipping_rate = NULL WHERE shipping_rate > 500;"))
            s.commit()
    except Exception as e:
        logger.warning(f"Could not auto-sanitize product shipping rates: {e}")
    yield
    heartbeat_task.cancel()
    try:
        await heartbeat_task
    except Exception:
        pass

root_path = "/api/backend" if os.getenv("VERCEL") else ""
app = FastAPI(
    title="VAHN Standalone Backend API",
    root_path=root_path,
    redirect_slashes=False,
    lifespan=lifespan
)

# Enterprise Gzip Payload Compression (compresses responses > 500 bytes by 70-80%)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache-Control middleware for storefront performance
@app.middleware("http")
async def add_cache_control_header(request, call_next):
    response = await call_next(request)
    if request.method == "GET" and response.status_code == 200:
        path = request.url.path
        if "/admin/" in path:
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        elif path.startswith("/api/products") or path.startswith("/api/collections"):
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
    return response

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
                    selectedOptions=[schemas.SelectedOption(name=str(opt.get("name", "")), value=str(opt.get("value", ""))) for opt in (v.selected_options or []) if isinstance(opt, dict)],
                    price=schemas.Money(amount=f"{v.price_amount:.2f}", currencyCode=v.price_currency),
                    compareAtPrice=schemas.Money(amount=f"{v.compare_at_price_amount:.2f}", currencyCode=v.compare_at_price_currency) if v.compare_at_price_amount else None,
                    image=schemas.ImageNode(url=v.image_url, altText=v.title) if v.image_url else None,
                    quantityAvailable=v.inventory_quantity
                )
            )
        )
    
    # Convert options (dynamically extracted from variants so all sizes & colours are always in sync)
    options_map: dict[str, list[str]] = {}
    if prod.variants:
        for v in prod.variants:
            for opt in v.selected_options:
                name = opt.get("name", "")
                val = opt.get("value", "")
                if name and val:
                    if name not in options_map:
                        options_map[name] = []
                    if val not in options_map[name]:
                        options_map[name].append(val)

    options_schemas = []
    if options_map:
        for idx, (name, values) in enumerate(options_map.items()):
            options_schemas.append(
                schemas.ProductOption(
                    id=f"option-{idx+1}",
                    name=name,
                    values=values
                )
            )
    else:
        for opt in (prod.options or []):
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
        # SCRUM-30: Only show reviews that are not hidden (is_hidden=False)
        for r in (prod.reviews or []) if not r.is_hidden
    ]

    colour_group_schemas = []
    for cg in (prod.colour_groups or []):
        parsed_imgs = []
        for img in (cg.images or []):
            if isinstance(img, str):
                if img.strip():
                    parsed_imgs.append(schemas.StorefrontColourGroupImageSchema(url=img.strip(), altText=cg.colour_value))
            elif isinstance(img, dict):
                u = img.get("url") or img.get("src") or ""
                if u:
                    parsed_imgs.append(schemas.StorefrontColourGroupImageSchema(
                        url=u,
                        altText=img.get("altText") or img.get("alt_text") or cg.colour_value
                    ))
            elif hasattr(img, "url") and getattr(img, "url"):
                parsed_imgs.append(schemas.StorefrontColourGroupImageSchema(
                    url=getattr(img, "url"),
                    altText=getattr(img, "alt_text", "") or cg.colour_value
                ))

        parsed_lookbook = []
        for item in (cg.lookbook or []):
            if isinstance(item, dict):
                parsed_lookbook.append(schemas.LookbookSchema(
                    id=str(item.get("id", "")),
                    imageUrl=item.get("imageUrl") or item.get("image_url") or "",
                    title=item.get("title") or "",
                    description=item.get("description") or ""
                ))
            elif hasattr(item, "imageUrl"):
                parsed_lookbook.append(schemas.LookbookSchema(
                    id=str(getattr(item, "id", "")),
                    imageUrl=getattr(item, "imageUrl", "") or getattr(item, "image_url", ""),
                    title=getattr(item, "title", ""),
                    description=getattr(item, "description", "") or ""
                ))

        colour_group_schemas.append(
            schemas.StorefrontColourGroupSchema(
                id=cg.id,
                colourValue=cg.colour_value,
                displayOrder=cg.display_order,
                images=parsed_imgs,
                lookbook=parsed_lookbook
            )
        )

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
        reviews=review_schemas,
        colourGroups=colour_group_schemas,
        fit=prod.fit,
        kitType=prod.kit_type,
        activity=prod.activity,
        gstPercent=prod.gst_percent if prod.gst_percent is not None else 12.0,
        shippingRate=prod.shipping_rate,
        sizeGuideTypeIds=prod.size_guide_type_ids or [],
        sizeFitDetails=prod.size_fit_details,
        careInstructions=prod.care_instructions,
        productDetails=prod.product_details,
        size_fit_details=prod.size_fit_details,
        care_instructions=prod.care_instructions,
        product_details=prod.product_details
    )


# ---- ENDPOINTS ----

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "VAHN Backend API",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/keep-alive")
def keep_alive_warmup(db: Session = Depends(get_db)):
    try:
        db.execute(sqlalchemy.text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    return {
        "status": "ok",
        "service": "VAHN Backend API",
        "warmed": True,
        "database": db_status,
        "timestamp": datetime.utcnow().isoformat()
    }

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
        selectinload(models.Product.reviews),
        selectinload(models.Product.colour_groups)
    ).filter_by(available_for_sale=True).all()
    return [db_product_to_schema(p) for p in products]

@app.get("/api/products/{handle}", response_model=schemas.ProductSchema)
def get_product(handle: str, db: Session = Depends(get_db)):
    prod = db.query(models.Product).options(
        selectinload(models.Product.variants),
        selectinload(models.Product.reviews),
        selectinload(models.Product.colour_groups)
    ).filter_by(handle=handle).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    # SCRUM-34/24: If product is marked unavailable, still return it so the
    # frontend can show "Out of Stock" — availableForSale=False signals this.
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

@app.get("/api/collections", response_model=List[schemas.CollectionListItemSchema])
def list_collections(db: Session = Depends(get_db)):
    colls = db.query(models.Collection).options(
        selectinload(models.Collection.products)
    ).all()
    return [
        schemas.CollectionListItemSchema(
            id=f"gid://shopify/Collection/{c.id}",
            handle=c.handle,
            title=c.title,
            description=c.description or "",
            image=schemas.ImageNode(url=c.image_url, altText=c.image_alt) if c.image_url else None,
            products_count=len(c.products)
        )
        for c in colls
    ]

@app.get("/api/collections/{handle}", response_model=schemas.CollectionSchema)
def get_collection(handle: str, db: Session = Depends(get_db)):
    coll = db.query(models.Collection).options(
        selectinload(models.Collection.products).selectinload(models.Product.variants),
        selectinload(models.Collection.products).selectinload(models.Product.reviews)
    ).filter_by(handle=handle).first()
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Map products — SCRUM-34: return all products in collection; unavailable ones render as Out of Stock
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
                        selectedOptions=[schemas.SelectedOption(name=str(opt.get("name", "")), value=str(opt.get("value", ""))) for opt in (v.selected_options or []) if isinstance(opt, dict)],
                        product=schemas.CartProductMini(
                            id=f"gid://shopify/Product/{p.id}",
                            title=p.title,
                            handle=p.handle,
                            featuredImage=schemas.ImageNode(url=p.featured_image_url, altText=p.featured_image_alt) if p.featured_image_url else None,
                            gstPercent=p.gst_percent if p.gst_percent is not None else 12.0,
                            shippingRate=p.shipping_rate
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
    cart = db.query(models.Cart).options(
        selectinload(models.Cart.items).selectinload(models.CartItem.variant).selectinload(models.ProductVariant.product)
    ).filter_by(id=cart_id).first()
    return build_cart_schema(cart, db)

@app.put("/api/cart/{cart_id}", response_model=schemas.CartSchema)
def sync_cart(cart_id: str, payload: List[dict] = [], db: Session = Depends(get_db)):
    cart = db.query(models.Cart).filter_by(id=cart_id).first()
    if not cart:
        cart = models.Cart(id=cart_id)
        db.add(cart)
        db.commit()

    # Clear existing items
    db.query(models.CartItem).filter_by(cart_id=cart_id).delete()
    db.commit()

    # Add new items
    for line in payload:
        variant_id = line.get("merchandiseId") or line.get("variant_id")
        qty = line.get("quantity", 1)
        if qty <= 0:
            continue

        variant = db.query(models.ProductVariant).filter_by(id=variant_id).first()
        if variant:
            # Clamp to stock
            if variant.inventory_quantity is not None and qty > variant.inventory_quantity:
                qty = variant.inventory_quantity
            item = models.CartItem(
                id=str(uuid.uuid4()),
                cart_id=cart_id,
                variant_id=variant_id,
                quantity=qty
            )
            db.add(item)

    db.commit()
    cart = db.query(models.Cart).options(
        selectinload(models.Cart.items).selectinload(models.CartItem.variant).selectinload(models.ProductVariant.product)
    ).filter_by(id=cart_id).first()
    return build_cart_schema(cart, db)

@app.get("/api/cart/{cart_id}", response_model=schemas.CartSchema)
def get_cart(cart_id: str, db: Session = Depends(get_db)):
    cart = db.query(models.Cart).options(
        selectinload(models.Cart.items).selectinload(models.CartItem.variant).selectinload(models.ProductVariant.product)
    ).filter_by(id=cart_id).first()
    if not cart:
        # Create it on demand to prevent UI errors
        cart = models.Cart(id=cart_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return build_cart_schema(cart, db)

@app.post("/api/cart/{cart_id}/items", response_model=schemas.CartSchema)
def add_to_cart(cart_id: str, payload: schemas.CartAddItemPayload, db: Session = Depends(get_db)):
    cart = db.query(models.Cart).filter_by(id=cart_id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    variant_id = payload.merchandiseId
    qty = payload.quantity

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
    cart = db.query(models.Cart).options(
        selectinload(models.Cart.items).selectinload(models.CartItem.variant).selectinload(models.ProductVariant.product)
    ).filter_by(id=cart_id).first()
    return build_cart_schema(cart, db)

@app.put("/api/cart/{cart_id}/items/{item_id}", response_model=schemas.CartSchema)
def update_cart_item(cart_id: str, item_id: str, payload: schemas.CartUpdateItemPayload, db: Session = Depends(get_db)):
    cart = db.query(models.Cart).filter_by(id=cart_id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    item = db.query(models.CartItem).filter_by(id=item_id, cart_id=cart_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    qty = payload.quantity
    if qty <= 0:
        db.delete(item)
    else:
        item.quantity = qty

    db.commit()
    cart = db.query(models.Cart).options(
        selectinload(models.Cart.items).selectinload(models.CartItem.variant).selectinload(models.ProductVariant.product)
    ).filter_by(id=cart_id).first()
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
    cart = db.query(models.Cart).options(
        selectinload(models.Cart.items).selectinload(models.CartItem.variant).selectinload(models.ProductVariant.product)
    ).filter_by(id=cart_id).first()
    return build_cart_schema(cart, db)

# ============================================================
# User Authentication & Profile Routes (Phone-First OTP Flow)
# ============================================================

def generate_6digit_otp() -> str:
    """Generate a cryptographically secure 6-digit OTP."""
    return "".join([str(secrets.randbelow(10)) for _ in range(6)])

def _user_schema(user: models.User) -> schemas.UserSchema:
    return schemas.UserSchema(
        id=user.id,
        phone=user.phone,
        email=user.email,
        full_name=user.full_name,
        is_verified=user.is_verified,
        created_at=user.created_at.strftime("%b %d, %Y") if user.created_at else None,
    )

@app.post("/api/auth/check-email")
def check_email(payload: schemas.EmailLookupRequest, db: Session = Depends(get_db)):
    """
    Probe whether an email address is already registered and verified.
    Returns {exists: bool} — no OTP sent, no side effects.
    """
    email = payload.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email).first()
    return {"exists": user is not None and user.is_verified}

@app.post("/api/auth/check-phone")
def check_phone(payload: schemas.PhoneLookupRequest, db: Session = Depends(get_db)):
    phone = normalize_phone(payload.phone)
    user = db.query(models.User).filter(models.User.phone == phone).first()
    return {"exists": user is not None and user.is_verified}

@app.post("/api/auth/send-otp")
def send_otp(payload: schemas.SendOTPRequest, db: Session = Depends(get_db)):
    """
    Unified register + login: send OTP to Email.
    - Existing user: OTP sent to registered email immediately.
    - New user: full_name and phone are REQUIRED; user record created (unverified) then OTP sent to email.
    Rate limited: max 3 per 10 min per email.
    """
    email = payload.email.strip().lower()
    check_rate_limit(email)  # Raises 429 if too many requests

    user = db.query(models.User).filter(models.User.email == email).first()

    if user and user.is_verified:
        # Existing verified user — login flow
        if not user.is_active:
            reason_msg = f" Reason: {user.suspension_reason}." if user.suspension_reason else ""
            raise HTTPException(status_code=403, detail=f"Your account has been suspended by administration.{reason_msg} Please contact support for assistance.")
        otp = generate_6digit_otp()
        otp_token = create_otp_token(email, otp)
        send_otp_email(email, otp, subject="Your VAHN Verification Code")
        return {"otp_token": otp_token, "is_new_user": False}

    else:
        # New user / unverified registration flow: full_name AND phone are REQUIRED
        if not payload.full_name or not payload.full_name.strip():
            raise HTTPException(
                status_code=422,
                detail="Full name is required to create your account."
            )
        if not payload.phone or not payload.phone.strip():
            raise HTTPException(
                status_code=422,
                detail="Phone number is required to create your account."
            )

        try:
            phone = normalize_phone(payload.phone)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

        # Check if phone is already registered to another verified account
        existing_phone = db.query(models.User).filter(
            models.User.phone == phone,
            models.User.email != email,
            models.User.is_verified == True
        ).first()
        if existing_phone:
            raise HTTPException(
                status_code=400,
                detail="This phone number is already registered to another account. Please use a different phone number."
            )

        try:
            if user:
                # Update existing unverified user record
                user.phone = phone
                user.full_name = payload.full_name.strip()
                if not user.role:
                    user.role = "customer"
                db.commit()
            else:
                # Clean up any stale unverified record with this phone number
                db.query(models.User).filter(
                    models.User.phone == phone,
                    models.User.is_verified == False
                ).delete()
                db.commit()

                # Create new user record (is_verified=False until OTP confirmed)
                new_user = models.User(
                    email=email,
                    phone=phone,
                    full_name=payload.full_name.strip(),
                    role="customer",
                    is_verified=False,
                    email_verified=False,
                    phone_verified=False,
                )
                db.add(new_user)
                db.commit()
        except Exception:
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to initialize account registration. Please try again.")

        otp = generate_6digit_otp()
        otp_token = create_otp_token(email, otp)
        send_otp_email(email, otp, subject="Your VAHN Welcome Verification Code")
        return {"otp_token": otp_token, "is_new_user": True}

@app.post("/api/auth/verify-otp", response_model=schemas.AuthResponse)
def verify_otp(payload: schemas.VerifyOTPRequest, db: Session = Depends(get_db)):
    """
    Verify OTP for customer login/registration via Email.
    - Validates HMAC-signed token (5-min expiry, max 5 attempts).
    - On success: marks user verified, returns JWT access token.
    """
    email = payload.email.strip().lower()

    # HMAC token verification (raises HTTPException on failure)
    verify_otp_token(email, payload.otp_code, payload.otp_token)

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found. Please start over.")
    if not user.is_active:
        reason_msg = f" Reason: {user.suspension_reason}." if user.suspension_reason else ""
        raise HTTPException(status_code=403, detail=f"Your account has been suspended by administration.{reason_msg} Please contact support for assistance.")

    user.is_verified = True
    user.email_verified = True
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email or "", role=user.role or "customer")
    return schemas.AuthResponse(access_token=token, token_type="bearer", user=_user_schema(user))

@app.get("/api/auth/me", response_model=schemas.UserSchema)
def get_me(current_user: models.User = Depends(get_current_user)):
    return _user_schema(current_user)

@app.put("/api/auth/profile", response_model=schemas.UserSchema)
def update_profile(payload: schemas.ProfileUpdateRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.full_name and payload.full_name.strip():
        current_user.full_name = payload.full_name.strip()

    if payload.phone and payload.phone.strip():
        phone = normalize_phone(payload.phone)
        # Check if phone is taken by ANOTHER user
        existing_phone_user = db.query(models.User).filter(
            models.User.phone == phone,
            models.User.id != current_user.id
        ).first()
        if existing_phone_user:
            raise HTTPException(
                status_code=400,
                detail="This phone number is already registered to another account."
            )
        current_user.phone = phone

    db.commit()
    db.refresh(current_user)
    return _user_schema(current_user)

# ============================================================
# Order & Checkout Routes (Strict Pydantic Validation)
# ============================================================

def build_order_schema(order: models.Order) -> schemas.OrderSchema:
    item_schemas = [
        schemas.OrderItemSchema(
            id=i.id,
            variantId=i.variant_id,
            productTitle=i.product_title,
            variantTitle=i.variant_title,
            imageUrl=i.image_url,
            price=schemas.Money(amount=f"{i.price_amount:.2f}", currencyCode=order.currency or "INR"),
            quantity=i.quantity
        ) for i in (order.items or [])
    ]

    return schemas.OrderSchema(
        id=order.id,
        order_id=order.id,
        orderId=order.id,
        status=order.status,
        refundStatus=order.refund_status,
        refundNote=order.refund_note,
        refundAmount=order.refund_amount or 0.0,
        refundedAt=order.refunded_at.strftime("%b %d, %Y") if order.refunded_at else None,
        cancellationReason=order.cancellation_reason,
        subtotalPrice=schemas.Money(amount=f"{order.subtotal_amount:.2f}", currencyCode=order.currency or "INR"),
        taxPrice=schemas.Money(amount=f"{getattr(order, 'tax_amount', 0.0) or 0.0:.2f}", currencyCode=order.currency or "INR"),
        shippingPrice=schemas.Money(amount=f"{getattr(order, 'shipping_amount', 0.0) or 0.0:.2f}", currencyCode=order.currency or "INR"),
        discountPrice=schemas.Money(amount=f"{getattr(order, 'discount_amount', 0.0) or 0.0:.2f}", currencyCode=order.currency or "INR"),
        totalPrice=schemas.Money(amount=f"{order.total_amount:.2f}", currencyCode=order.currency or "INR"),
        shippingAddress=order.shipping_address,
        createdAt=order.created_at.strftime("%b %d, %Y") if order.created_at else "",
        items=item_schemas,
        isGuest=order.is_guest or False,
        guestName=order.guest_name,
        guestEmail=order.guest_email,
        guestPhone=order.guest_phone,
        paymentMethod=order.payment_method or "ONLINE",
        paymentStatus=order.payment_status or "PENDING",
        razorpayOrderId=order.razorpay_order_id,
        razorpayPaymentId=order.razorpay_payment_id,
        shiprocketAwb=order.shiprocket_awb,
        shiprocketCourierName=order.shiprocket_courier_name,
        shippingStatus=order.shipping_status or "UNFULFILLED",
        trackingUrl=order.tracking_url,
        trackingData=order.tracking_data or {},
        deliveredAt=order.delivered_at.strftime("%b %d, %Y") if order.delivered_at else None,
        returnStatus=order.return_status or "NONE",
        returnType=order.return_type or "RETURN",
        returnReason=order.return_reason,
        returnNotes=order.return_notes,
        reverseAwb=order.reverse_awb,
        reverseCourierName=order.reverse_courier_name,
        reverseTrackingData=order.reverse_tracking_data or {},
        replacementVariantId=order.replacement_variant_id,
        replacementVariantTitle=order.replacement_variant_title,
        replacementStatus=order.replacement_status or "NONE",
        replacementShipmentId=order.replacement_shipment_id,
        replacementAwb=order.replacement_awb,
        replacementCourierName=order.replacement_courier_name,
        replacementTrackingUrl=order.replacement_tracking_url
    )

# ============================================================
# USER ADDRESS BOOK ROUTES (India Only Validation)
# ============================================================

@app.get("/api/user/addresses", response_model=List[schemas.UserAddressSchema])
def get_user_addresses(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):

    addresses = db.query(models.UserAddress).filter_by(user_id=current_user.id).order_by(models.UserAddress.is_default.desc(), models.UserAddress.created_at.desc()).all()
    return [
        schemas.UserAddressSchema(
            id=a.id,
            user_id=a.user_id,
            label=a.label or "Home",
            first_name=a.first_name,
            last_name=a.last_name,
            street_address=a.street_address,
            apartment=a.apartment,
            house_flat_no=a.house_flat_no,
            building_name=a.building_name,
            floor_no=a.floor_no,
            block_wing=a.block_wing,
            city=a.city,
            state=a.state,
            pincode=a.pincode,
            country=a.country or "India",
            phone=a.phone,
            email=a.email,
            latitude=a.latitude,
            longitude=a.longitude,
            is_default=a.is_default,
            created_at=a.created_at.strftime("%b %d, %Y")
        ) for a in addresses
    ]

@app.post("/api/user/addresses", response_model=schemas.UserAddressSchema)
def create_user_address(payload: schemas.UserAddressCreateRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.country.strip().lower() not in ["india", "in"]:
        raise HTTPException(status_code=400, detail="Shipping is currently only available within India.")

    import re
    if not re.match(r'^[1-9][0-9]{5}$', payload.pincode.strip()):
        raise HTTPException(status_code=400, detail="Please enter a valid 6-digit Indian PIN Code (e.g. 400001).")

    existing_count = db.query(models.UserAddress).filter_by(user_id=current_user.id).count()
    is_default = payload.is_default or existing_count == 0

    if is_default:
        db.query(models.UserAddress).filter_by(user_id=current_user.id).update({"is_default": False})

    addr = models.UserAddress(
        user_id=current_user.id,
        label=payload.label or "Home",
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        street_address=payload.street_address.strip(),
        apartment=payload.apartment.strip() if payload.apartment else None,
        house_flat_no=payload.house_flat_no.strip() if payload.house_flat_no else None,
        building_name=payload.building_name.strip() if payload.building_name else None,
        floor_no=payload.floor_no.strip() if payload.floor_no else None,
        block_wing=payload.block_wing.strip() if payload.block_wing else None,
        city=payload.city.strip(),
        state=payload.state.strip(),
        pincode=payload.pincode.strip(),
        country="India",
        phone=payload.phone.strip(),
        email=payload.email.strip() if payload.email else None,
        latitude=payload.latitude,
        longitude=payload.longitude,
        is_default=is_default
    )
    db.add(addr)
    db.commit()
    db.refresh(addr)

    return schemas.UserAddressSchema(
        id=addr.id,
        user_id=addr.user_id,
        label=addr.label,
        first_name=addr.first_name,
        last_name=addr.last_name,
        street_address=addr.street_address,
        apartment=addr.apartment,
        house_flat_no=addr.house_flat_no,
        building_name=addr.building_name,
        floor_no=addr.floor_no,
        block_wing=addr.block_wing,
        city=addr.city,
        state=addr.state,
        pincode=addr.pincode,
        country=addr.country,
        phone=addr.phone,
        email=addr.email,
        latitude=addr.latitude,
        longitude=addr.longitude,
        is_default=addr.is_default,
        created_at=addr.created_at.strftime("%b %d, %Y")
    )

@app.put("/api/user/addresses/{address_id}", response_model=schemas.UserAddressSchema)
def update_user_address(address_id: int, payload: schemas.UserAddressCreateRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    addr = db.query(models.UserAddress).filter_by(id=address_id, user_id=current_user.id).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found.")

    if payload.country.strip().lower() not in ["india", "in"]:
        raise HTTPException(status_code=400, detail="Shipping is currently only available within India.")

    import re
    if not re.match(r'^[1-9][0-9]{5}$', payload.pincode.strip()):
        raise HTTPException(status_code=400, detail="Please enter a valid 6-digit Indian PIN Code (e.g. 400001).")

    if payload.is_default and not addr.is_default:
        db.query(models.UserAddress).filter_by(user_id=current_user.id).update({"is_default": False})
        addr.is_default = True

    addr.label = payload.label or "Home"
    addr.first_name = payload.first_name.strip()
    addr.last_name = payload.last_name.strip()
    addr.street_address = payload.street_address.strip()
    addr.apartment = payload.apartment.strip() if payload.apartment else None
    addr.house_flat_no = payload.house_flat_no.strip() if payload.house_flat_no else None
    addr.building_name = payload.building_name.strip() if payload.building_name else None
    addr.floor_no = payload.floor_no.strip() if payload.floor_no else None
    addr.block_wing = payload.block_wing.strip() if payload.block_wing else None
    addr.city = payload.city.strip()
    addr.state = payload.state.strip()
    addr.pincode = payload.pincode.strip()
    addr.phone = payload.phone.strip()
    addr.email = payload.email.strip() if payload.email else None
    if payload.latitude is not None:
        addr.latitude = payload.latitude
    if payload.longitude is not None:
        addr.longitude = payload.longitude

    db.commit()
    db.refresh(addr)

    return schemas.UserAddressSchema(
        id=addr.id,
        user_id=addr.user_id,
        label=addr.label,
        first_name=addr.first_name,
        last_name=addr.last_name,
        street_address=addr.street_address,
        apartment=addr.apartment,
        house_flat_no=addr.house_flat_no,
        building_name=addr.building_name,
        floor_no=addr.floor_no,
        block_wing=addr.block_wing,
        city=addr.city,
        state=addr.state,
        pincode=addr.pincode,
        country=addr.country,
        phone=addr.phone,
        email=addr.email,
        latitude=addr.latitude,
        longitude=addr.longitude,
        is_default=addr.is_default,
        created_at=addr.created_at.strftime("%b %d, %Y")
    )

@app.put("/api/user/addresses/{address_id}/default")

def set_default_address(address_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):

    addr = db.query(models.UserAddress).filter_by(id=address_id, user_id=current_user.id).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found.")

    db.query(models.UserAddress).filter_by(user_id=current_user.id).update({"is_default": False})
    addr.is_default = True
    db.commit()
    return {"message": "Default address updated."}

@app.delete("/api/user/addresses/{address_id}")
def delete_user_address(address_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    addr = db.query(models.UserAddress).filter_by(id=address_id, user_id=current_user.id).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found.")
    db.delete(addr)
    db.commit()
    return {"message": "Address deleted."}

# ============================================================
# CHECKOUT, PREPAID PAYMENTS & SHIPROCKET LOGISTICS
# ============================================================

def calculate_cart_pricing(cart: models.Cart):
    subtotal = 0.0
    tax_amount = 0.0
    custom_shipping_rates = []
    items_summary = []

    for item in cart.items:
        var = item.variant
        prod = var.product if var else None
        item_price = var.price_amount if var else 0.0
        line_total = item_price * item.quantity
        subtotal += line_total

        items_summary.append({
            "title": prod.title if prod else "Product",
            "variant": var.title if var else "Default",
            "quantity": item.quantity,
            "price": item_price
        })

        gst_pct = prod.gst_percent if (prod and prod.gst_percent is not None) else 12.0
        item_tax = line_total * (gst_pct / (100.0 + gst_pct))
        tax_amount += item_tax

        if prod and prod.shipping_rate is not None and prod.shipping_rate <= 500:
            custom_shipping_rates.append(prod.shipping_rate)

    if subtotal >= 1999.0 or subtotal == 0:
        shipping_amount = 0.0
    elif custom_shipping_rates:
        shipping_amount = max(custom_shipping_rates)
    else:
        shipping_amount = 99.0

    tax_amount = round(tax_amount, 2)
    total_amount = subtotal + shipping_amount
    return subtotal, shipping_amount, tax_amount, total_amount, items_summary

def resolve_shipping_address(address_id: Optional[int], shipping_address: Optional[dict], user: Optional[models.User], db: Session) -> dict:
    if address_id and user:
        user_addr = db.query(models.UserAddress).filter_by(id=address_id, user_id=user.id).first()
        if user_addr:
            return {
                "label": user_addr.label,
                "name": f"{user_addr.first_name} {user_addr.last_name}",
                "address": f"{user_addr.street_address}{f', {user_addr.apartment}' if user_addr.apartment else ''}",
                "city": user_addr.city,
                "state": user_addr.state,
                "postalCode": user_addr.pincode,
                "country": "India",
                "phone": user_addr.phone
            }

    if shipping_address:
        raw_addr = shipping_address
        pincode = str(raw_addr.get("postalCode", raw_addr.get("pincode", ""))).strip()
        import re
        if not re.match(r'^[1-9][0-9]{5}$', pincode):
            pincode = "400001"
        return {
            "label": raw_addr.get("label", "Home"),
            "name": raw_addr.get("name", (user.full_name if user else "Athlete")),
            "address": raw_addr.get("address", raw_addr.get("street_address", "Standard Address")),
            "city": raw_addr.get("city", "Mumbai"),
            "state": raw_addr.get("state", "Maharashtra"),
            "postalCode": pincode,
            "country": "India",
            "phone": raw_addr.get("phone", (user.phone if user else ""))
        }

    if user:
        default_addr = db.query(models.UserAddress).filter_by(user_id=user.id, is_default=True).first() or db.query(models.UserAddress).filter_by(user_id=user.id).first()
        if default_addr:
            return {
                "label": default_addr.label,
                "name": f"{default_addr.first_name} {default_addr.last_name}",
                "address": f"{default_addr.street_address}{f', {default_addr.apartment}' if default_addr.apartment else ''}",
                "city": default_addr.city,
                "state": default_addr.state,
                "postalCode": default_addr.pincode,
                "country": "India",
                "phone": default_addr.phone
            }

    return {
        "label": "Home",
        "name": (user.full_name if user else "Athlete"),
        "address": "Standard Express Shipping",
        "city": "Mumbai",
        "state": "Maharashtra",
        "postalCode": "400001",
        "country": "India",
        "phone": "+91 9876543210"
    }

def _async_create_shiprocket_order(order_id: str):
    """Background task to create Shiprocket forward shipment and assign AWB."""
    db = next(get_db())
    try:
        order = db.query(models.Order).options(selectinload(models.Order.items), selectinload(models.Order.user)).filter_by(id=order_id).first()
        if not order:
            return
        res = shiprocket_service.create_forward_shipment(order, order.items or [], db=db)
        if res:
            order.shiprocket_order_id = res.get("shiprocket_order_id")
            order.shiprocket_shipment_id = res.get("shiprocket_shipment_id")
            order.shiprocket_awb = res.get("shiprocket_awb")
            order.shiprocket_courier_name = res.get("shiprocket_courier_name")
            order.shipping_status = res.get("shipping_status", "MANIFEST_GENERATED")
            order.tracking_data = {
                "awb": res.get("shiprocket_awb"),
                "courier_name": res.get("shiprocket_courier_name"),
                "current_status": "MANIFEST_GENERATED",
                "scans": [
                    {
                        "date": datetime.utcnow().strftime("%b %d, %Y - %I:%M %p"),
                        "activity": "Order Confirmed & Manifest Generated for Dispatch",
                        "location": "VAHN Warehouse"
                    }
                ]
            }
            db.commit()
    except Exception as e:
        logger.error(f"Error in background Shiprocket forward shipment for {order_id}: {e}")
    finally:
        db.close()

# 1. Check PIN Code Serviceability (Public)
@app.post("/api/shipping/serviceability", response_model=schemas.ShiprocketServiceabilityResponse)
def check_pincode_serviceability(payload: schemas.ShiprocketServiceabilityRequest, db: Session = Depends(get_db)):
    result = shiprocket_service.check_serviceability(payload.pincode, payload.weight or 0.5, db=db)
    return schemas.ShiprocketServiceabilityResponse(
        serviceable=result.get("serviceable", False),
        estimated_days=result.get("estimated_days", "N/A"),
        courier_name=result.get("courier_name"),
        pincode=payload.pincode,
        is_cod=False,
        shipping_rate=result.get("shipping_rate"),
        etd=result.get("etd"),
        message=result.get("message")
    )

# 2. Create Razorpay Order for Logged-In User
@app.post("/api/payments/razorpay/create-order", response_model=schemas.RazorpayCreateOrderResponse)
def razorpay_create_order(
    payload: schemas.RazorpayCreateOrderRequest,
    current_user: Optional[models.User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    cart = db.query(models.Cart).options(
        selectinload(models.Cart.items).selectinload(models.CartItem.variant).selectinload(models.ProductVariant.product)
    ).filter_by(id=payload.cart_id).first()

    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty or not found.")

    # Validate stock before initiating payment
    for item in cart.items:
        var = item.variant
        if var and var.inventory_quantity < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {var.title}. Only {var.inventory_quantity} remaining.")

    subtotal, shipping_fee, tax_amount, total_amount, _ = calculate_cart_pricing(cart)
    receipt_id = f"REC-{secrets.randbelow(899999) + 100000}"

    notes = {
        "cart_id": payload.cart_id,
        "is_guest": "false" if current_user else "true",
        "user_id": str(current_user.id) if current_user else "",
        "user_email": current_user.email if current_user else "",
        "user_phone": current_user.phone if current_user else ""
    }

    # Line items required to activate Razorpay Magic Checkout (OPC)
    line_items = []
    for item in cart.items:
        var = item.variant
        prod = var.product if var else None
        item_title = f"{prod.title if prod else 'VAHN Gear'}{f' - {var.title}' if var and var.title and var.title != 'Default Title' else ''}"
        unit_price = float(var.price_amount) if (var and var.price_amount is not None) else 0.0
        line_items.append({
            "sku": str(getattr(var, 'sku', None) or var.id) if var else str(item.id),
            "variant_id": str(var.id) if var else str(item.id),
            "price": int(round(unit_price * 100)),
            "offer_price": int(round(unit_price * 100)),
            "quantity": item.quantity,
            "name": item_title[:255]
        })
    line_items_total = int(round(subtotal * 100))

    # For Razorpay Magic Checkout, base order amount MUST match line_items_total
    # Magic Checkout dynamically calculates and appends the shipping charge from your dashboard slabs
    rzp_order = razorpay_service.create_order(
        amount_in_inr=subtotal,
        receipt_id=receipt_id,
        notes=notes,
        line_items=line_items,
        line_items_total=line_items_total
    )

    return schemas.RazorpayCreateOrderResponse(
        razorpay_order_id=rzp_order["id"],
        amount=rzp_order["amount"],
        currency=rzp_order.get("currency", "INR"),
        key_id=razorpay_service.get_key_id(),
        receipt=receipt_id,
        subtotal=subtotal,
        shipping_fee=shipping_fee,
        tax_amount=tax_amount,
        total_amount=total_amount
    )

# 3. Verify Razorpay Payment & Confirm Logged-In Order
@app.post("/api/payments/razorpay/verify", response_model=schemas.OrderSchema)
def razorpay_verify_payment(
    payload: schemas.RazorpayVerifyPaymentRequest,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify cryptographic signature
    is_valid = razorpay_service.verify_payment_signature(
        razorpay_order_id=payload.razorpay_order_id,
        razorpay_payment_id=payload.razorpay_payment_id,
        razorpay_signature=payload.razorpay_signature
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail="Cryptographic payment signature verification failed.")

    cart = db.query(models.Cart).options(
        selectinload(models.Cart.items).selectinload(models.CartItem.variant).selectinload(models.ProductVariant.product)
    ).filter_by(id=payload.cart_id).first()

    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cart items could not be found.")

    final_address = resolve_shipping_address(payload.address_id, payload.shipping_address, current_user, db)
    subtotal, shipping_amount, tax_amount, total_amount, items_summary = calculate_cart_pricing(cart)

    # Decrement stock
    for item in cart.items:
        var = item.variant
        if var:
            if var.inventory_quantity < item.quantity:
                # Race condition: item went out of stock during payment
                # Auto-refund payment immediately
                razorpay_service.initiate_refund(
                    payment_id=payload.razorpay_payment_id,
                    amount_in_inr=total_amount,
                    reason_note=f"Stock exhausted for {var.title}"
                )
                raise HTTPException(status_code=400, detail="Stock was exhausted during payment. A 100% refund has been initiated to your payment method.")
            var.inventory_quantity = max(0, var.inventory_quantity - item.quantity)

    order_id = f"ORD-{secrets.randbelow(899999) + 100000}"
    order = models.Order(
        id=order_id,
        user_id=current_user.id,
        is_guest=False,
        status="PROCESSING",
        payment_method="RAZORPAY_CUSTOM",
        payment_status="CAPTURED",
        razorpay_order_id=payload.razorpay_order_id,
        razorpay_payment_id=payload.razorpay_payment_id,
        razorpay_signature=payload.razorpay_signature,
        subtotal_amount=subtotal,
        shipping_amount=shipping_amount,
        tax_amount=tax_amount,
        discount_amount=0.0,
        total_amount=total_amount,
        currency="INR",
        shipping_address=final_address,
        shipping_status="UNFULFILLED"
    )
    db.add(order)
    db.flush()

    for item in cart.items:
        var = item.variant
        prod = var.product if var else None
        order_item = models.OrderItem(
            id=str(uuid.uuid4()),
            order_id=order.id,
            variant_id=item.variant_id,
            product_title=prod.title if prod else "Product",
            variant_title=var.title if var else "Default",
            image_url=var.image_url if (var and var.image_url) else (prod.featured_image_url if prod else None),
            price_amount=var.price_amount if var else 0.0,
            quantity=item.quantity
        )
        db.add(order_item)

    # Empty cart
    for item in cart.items:
        db.delete(item)

    db.commit()
    db.refresh(order)

    # Dispatch Shiprocket shipment in background
    background_tasks.add_task(_async_create_shiprocket_order, order.id)

    # Send Order Confirmation Email
    if current_user.email:
        background_tasks.add_task(
            send_order_confirmation_email,
            to_email=current_user.email,
            order_id=order.id,
            total_amount=order.total_amount,
            currency=order.currency,
            items_summary=items_summary
        )

    return build_order_schema(order)

# 3b. Record Razorpay Payment Failure (Preserves Cart, Records Pending Order for Recovery)
@app.post("/api/payments/razorpay/record-failure", response_model=schemas.OrderSchema)
def razorpay_record_failure(
    payload: schemas.RazorpayRecordFailureRequest,
    current_user: Optional[models.User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    # If existing order_id provided, update it
    if payload.order_id:
        existing = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(id=payload.order_id).first()
        if existing:
            if existing.payment_status != "CAPTURED":
                existing.payment_status = "FAILED"
                existing.status = "PENDING_PAYMENT"
                existing.cancellation_reason = payload.error_description or payload.error_reason or "Payment session declined or failed."
                if payload.razorpay_order_id:
                    existing.razorpay_order_id = payload.razorpay_order_id
                if payload.razorpay_payment_id:
                    existing.razorpay_payment_id = payload.razorpay_payment_id
                db.commit()
                db.refresh(existing)
            return build_order_schema(existing)

    # If no order_id, locate cart and create an order with status PENDING_PAYMENT / FAILED
    if not payload.cart_id:
        raise HTTPException(status_code=400, detail="cart_id or order_id is required to record failure.")

    cart = db.query(models.Cart).options(
        selectinload(models.Cart.items).selectinload(models.CartItem.variant).selectinload(models.ProductVariant.product)
    ).filter_by(id=payload.cart_id).first()

    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty or not found.")

    subtotal, shipping_amount, tax_amount, total_amount, _ = calculate_cart_pricing(cart)
    final_address = resolve_shipping_address(None, payload.shipping_address, current_user, db)

    order_id = f"ORD-{secrets.randbelow(899999) + 100000}"
    order = models.Order(
        id=order_id,
        user_id=current_user.id if current_user else None,
        is_guest=current_user is None,
        guest_name=payload.customer_name,
        guest_email=payload.customer_email,
        guest_phone=payload.customer_phone,
        status="PENDING_PAYMENT",
        payment_method="RAZORPAY_CUSTOM",
        payment_status="FAILED",
        razorpay_order_id=payload.razorpay_order_id,
        razorpay_payment_id=payload.razorpay_payment_id,
        cancellation_reason=payload.error_description or payload.error_reason or "Payment session declined or failed.",
        subtotal_amount=subtotal,
        shipping_amount=shipping_amount,
        tax_amount=tax_amount,
        discount_amount=0.0,
        total_amount=total_amount,
        currency="INR",
        shipping_address=final_address,
        shipping_status="UNFULFILLED"
    )
    db.add(order)
    db.flush()

    for item in cart.items:
        var = item.variant
        prod = var.product if var else None
        order_item = models.OrderItem(
            id=str(uuid.uuid4()),
            order_id=order.id,
            variant_id=item.variant_id,
            product_title=prod.title if prod else "Product",
            variant_title=var.title if var else "Default",
            image_url=var.image_url if (var and var.image_url) else (prod.featured_image_url if prod else None),
            price_amount=var.price_amount if var else 0.0,
            quantity=item.quantity
        )
        db.add(order_item)

    # Note: We intentionally DO NOT delete cart.items on failure so cart is preserved!
    db.commit()
    db.refresh(order)

    return build_order_schema(order)

# 3.1 Razorpay Magic Checkout Dynamic Shipping Info API (2-Way Serviceability with Shiprocket)
@app.post("/api/magic/shipping-info")
@app.get("/api/magic/shipping-info")
async def magic_checkout_shipping_info(request: Request, db: Session = Depends(get_db)):
    """
    Official Razorpay Magic Checkout Shipping Info API endpoint.
    Called by Razorpay Magic Checkout modal when customer enters a delivery zipcode.
    Queries live Shiprocket serviceability and returns serviceable: true and shipping fees.
    """
    data = {}
    raw_body = ""
    try:
        if request.method == "POST":
            content_type = request.headers.get("content-type", "")
            if "json" in content_type:
                data = await request.json()
            else:
                body_bytes = await request.body()
                raw_body = body_bytes.decode("utf-8", errors="ignore")
                try:
                    data = json.loads(raw_body)
                except Exception:
                    try:
                        form = await request.form()
                        data = dict(form)
                    except Exception:
                        data = {}
        else:
            data = dict(request.query_params)
    except Exception as e:
        logger.warning(f"Error parsing Magic Shipping Info request: {e}")
        data = {}

    logger.info(f"Magic Shipping Info Request: method={request.method}, data={data}")

    # Extract all possible addresses from the payload
    addresses = data.get("addresses") or []
    if not isinstance(addresses, list):
        addresses = [addresses] if isinstance(addresses, dict) else []

    # Check for single address objects
    if not addresses:
        single_addr = data.get("address") or data.get("shipping_address")
        if isinstance(single_addr, dict):
            addresses = [single_addr]

    # Check for direct zipcode fields
    if not addresses:
        direct_zip = (
            data.get("zipcode")
            or data.get("pincode")
            or data.get("postal_code")
            or data.get("delivery_postcode")
            or data.get("postcode")
            or request.query_params.get("zipcode")
            or request.query_params.get("pincode")
        )
        if direct_zip:
            addresses = [{
                "id": str(data.get("id", "0")),
                "zipcode": str(direct_zip).strip(),
                "state_code": data.get("state_code", ""),
                "country": data.get("country", "IN")
            }]
        elif raw_body:
            import re
            pins = re.findall(r"\b[1-9][0-9]{5}\b", raw_body)
            if pins:
                addresses = [{
                    "id": "0",
                    "zipcode": pins[0],
                    "country": "IN"
                }]

    # Fallback to standard 831003 if still empty
    if not addresses:
        addresses = [{
            "id": "0",
            "zipcode": "831003",
            "country": "IN"
        }]

    res_addresses = []
    res_shipping_methods = []

    for addr in addresses:
        addr_id = str(addr.get("id", "0"))
        zipcode = str(
            addr.get("zipcode")
            or addr.get("pincode")
            or addr.get("postal_code")
            or addr.get("delivery_postcode")
            or "831003"
        ).strip()
        state_code = addr.get("state_code", "")
        country = addr.get("country", "IN")

        # Query live Shiprocket serviceability for this pincode
        sr_res = shiprocket_service.check_serviceability(zipcode, weight=0.5, db=db)
        courier_name = sr_res.get("courier_name") or "Ekart Logistics Air"
        est_days = sr_res.get("estimated_days") or "3 business days"
        if est_days == "N/A" or not est_days:
            est_days = "3 business days"

        # Free shipping for orders (₹0 fee paise)
        shipping_fee_paise = 0

        method_obj = {
            "id": "standard_shipping",
            "name": f"Standard Delivery ({est_days})",
            "description": f"Delivered via {courier_name}",
            "serviceable": True,
            "shipping_fee": shipping_fee_paise,
            "cod": False,
            "cod_fee": 0
        }

        res_shipping_methods.append(method_obj)
        res_addresses.append({
            "id": addr_id,
            "zipcode": zipcode,
            "state_code": state_code,
            "country": country,
            "serviceable": True,
            "shipping_methods": [method_obj]
        })

    # Return comprehensive format supporting addresses array, methods, and serviceable flag
    return {
        "success": True,
        "serviceable": True,
        "addresses": res_addresses,
        "shipping_methods": res_shipping_methods
    }

# 4. Razorpay Magic Checkout Callback (Guest / 1-Click Checkout — No Login Required)
@app.post("/api/orders/magic-checkout", response_model=schemas.OrderSchema)
def magic_checkout_order(
    payload: schemas.MagicCheckoutOrderRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    cart = db.query(models.Cart).options(
        selectinload(models.Cart.items).selectinload(models.CartItem.variant).selectinload(models.ProductVariant.product)
    ).filter_by(id=payload.cart_id).first()

    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty or not found.")

    subtotal, shipping_amount, tax_amount, total_amount, items_summary = calculate_cart_pricing(cart)

    # Validate and decrement stock
    for item in cart.items:
        var = item.variant
        if var:
            if var.inventory_quantity < item.quantity:
                razorpay_service.initiate_refund(
                    payment_id=payload.razorpay_payment_id,
                    amount_in_inr=total_amount,
                    reason_note=f"Stock exhausted for {var.title}"
                )
                raise HTTPException(status_code=400, detail="Stock exhausted during checkout. A 100% refund has been initiated.")
            var.inventory_quantity = max(0, var.inventory_quantity - item.quantity)

    # Format structured shipping address and customer identity from Razorpay Magic Checkout
    raw_addr = payload.shipping_address or {}
    rzp_order_obj = {}
    rzp_cust_details = {}
    rzp_shipping = {}

    if payload.razorpay_order_id:
        try:
            details = razorpay_service.fetch_order_details(payload.razorpay_order_id)
            rzp_order_obj = details.get("order") or {}
            rzp_cust_details = rzp_order_obj.get("customer_details") or {}
            rzp_shipping = rzp_cust_details.get("shipping_address") or rzp_cust_details.get("billing_address") or {}
        except Exception as e:
            logger.warning(f"Could not fetch Razorpay order details: {e}")

    rzp_payment = {}
    if payload.razorpay_payment_id:
        try:
            rzp_payment = razorpay_service.fetch_payment(payload.razorpay_payment_id) or {}
        except Exception as e:
            logger.warning(f"Could not fetch payment from Razorpay: {e}")

    # Extract customer name
    cust_name = (
        rzp_shipping.get("name")
        or rzp_cust_details.get("name")
        or payload.customer_name
        or payload.guest_name
        or raw_addr.get("name")
        or rzp_payment.get("notes", {}).get("name")
        or "Athlete"
    ).strip()

    # Extract customer email
    cust_email = (
        rzp_cust_details.get("email")
        or rzp_payment.get("email")
        or payload.customer_email
        or payload.guest_email
        or raw_addr.get("email")
        or ""
    ).strip().lower() or None

    # Extract customer phone
    raw_phone = (
        rzp_cust_details.get("contact")
        or rzp_shipping.get("contact")
        or rzp_payment.get("contact")
        or payload.customer_phone
        or payload.guest_phone
        or raw_addr.get("phone")
        or ""
    ).strip()

    cust_phone = None
    if raw_phone:
        try:
            cust_phone = normalize_phone(raw_phone)
        except Exception:
            cleaned_digits = re.sub(r'\D', '', raw_phone)
            if len(cleaned_digits) == 10:
                cust_phone = f"+91{cleaned_digits}"
            elif len(cleaned_digits) > 10:
                cust_phone = f"+{cleaned_digits}"
            else:
                cust_phone = raw_phone

    # Extract address components from Razorpay Magic Checkout
    rzp_line1 = str(rzp_shipping.get("line1", "")).strip()
    rzp_line2 = str(rzp_shipping.get("line2", "")).strip()
    rzp_street = f"{rzp_line1}, {rzp_line2}".strip(", ") if (rzp_line1 or rzp_line2) else ""

    street_val = (
        rzp_street
        or raw_addr.get("address")
        or raw_addr.get("street_address")
        or "Standard Delivery"
    )
    city_val = rzp_shipping.get("city") or raw_addr.get("city") or "Mumbai"
    state_val = rzp_shipping.get("state") or raw_addr.get("state") or "Maharashtra"
    pincode_val = str(
        rzp_shipping.get("zipcode")
        or rzp_shipping.get("postal_code")
        or raw_addr.get("postalCode")
        or raw_addr.get("pincode")
        or "400001"
    ).strip()
    country_val = rzp_shipping.get("country") or raw_addr.get("country") or "India"
    if str(country_val).lower() in ("in", "ind"):
        country_val = "India"

    final_address = {
        "label": rzp_shipping.get("tag") or "Delivery",
        "name": cust_name,
        "address": street_val,
        "city": city_val,
        "state": state_val,
        "postalCode": pincode_val,
        "country": country_val,
        "phone": cust_phone or raw_phone or ""
    }

    # Automatically save or link customer account in database (models.User)
    user = None
    if cust_email:
        user = db.query(models.User).filter(models.User.email == cust_email).first()
    if not user and cust_phone:
        user = db.query(models.User).filter(models.User.phone == cust_phone).first()

    if user:
        # Update missing customer details if present
        if (not user.full_name or user.full_name in ("Athlete", "Customer", "Guest", "")) and cust_name:
            user.full_name = cust_name
        if not user.email and cust_email:
            existing_email_user = db.query(models.User).filter(models.User.email == cust_email).first()
            if not existing_email_user:
                user.email = cust_email
                user.email_verified = True
        if not user.phone and cust_phone:
            existing_phone_user = db.query(models.User).filter(models.User.phone == cust_phone).first()
            if not existing_phone_user:
                user.phone = cust_phone
                user.phone_verified = True
        db.flush()
    else:
        # Auto-create new customer in database (saved with role='customer')
        user = models.User(
            email=cust_email,
            email_verified=bool(cust_email),
            phone=cust_phone,
            phone_verified=bool(cust_phone),
            full_name=cust_name or "Guest Customer",
            role="customer",
            is_verified=True,
            is_active=True,
            password_hash=None,
            salt=None
        )
        db.add(user)
        db.flush()

    # Automatically link / save customer delivery address
    if user and user.id:
        name_parts = cust_name.split(" ", 1)
        first_name = name_parts[0] if name_parts else "Guest"
        last_name = name_parts[1] if len(name_parts) > 1 else ""
        street_val = final_address.get("address", "").strip()
        pincode_val = str(final_address.get("postalCode", "")).strip()

        if street_val:
            existing_addr = db.query(models.UserAddress).filter(
                models.UserAddress.user_id == user.id,
                models.UserAddress.street_address == street_val,
                models.UserAddress.pincode == pincode_val
            ).first()
            if not existing_addr:
                user_addr = models.UserAddress(
                    user_id=user.id,
                    label="Delivery",
                    first_name=first_name,
                    last_name=last_name,
                    street_address=street_val,
                    city=final_address.get("city", "Mumbai"),
                    state=final_address.get("state", "Maharashtra"),
                    pincode=pincode_val or "400001",
                    country="India",
                    phone=cust_phone or raw_phone or "",
                    email=cust_email,
                    is_default=True
                )
                db.add(user_addr)
                db.flush()

    order_id = f"ORD-{secrets.randbelow(899999) + 100000}"
    is_registered_athlete = bool(user and user.password_hash)
    order = models.Order(
        id=order_id,
        user_id=user.id if user else None,
        is_guest=not is_registered_athlete,
        guest_name=cust_name,
        guest_email=cust_email,
        guest_phone=cust_phone or raw_phone,
        status="PROCESSING",
        payment_method="RAZORPAY_MAGIC",
        payment_status="CAPTURED",
        razorpay_order_id=payload.razorpay_order_id,
        razorpay_payment_id=payload.razorpay_payment_id,
        razorpay_signature=payload.razorpay_signature,
        subtotal_amount=subtotal,
        shipping_amount=shipping_amount,
        tax_amount=tax_amount,
        discount_amount=0.0,
        total_amount=total_amount,
        currency="INR",
        shipping_address=final_address,
        shipping_status="UNFULFILLED"
    )
    db.add(order)
    db.flush()

    for item in cart.items:
        var = item.variant
        prod = var.product if var else None
        order_item = models.OrderItem(
            id=str(uuid.uuid4()),
            order_id=order.id,
            variant_id=item.variant_id,
            product_title=prod.title if prod else "Product",
            variant_title=var.title if var else "Default",
            image_url=var.image_url if (var and var.image_url) else (prod.featured_image_url if prod else None),
            price_amount=var.price_amount if var else 0.0,
            quantity=item.quantity
        )
        db.add(order_item)

    # Empty cart
    for item in cart.items:
        db.delete(item)

    db.commit()
    db.refresh(order)

    # Dispatch Shiprocket shipment in background
    background_tasks.add_task(_async_create_shiprocket_order, order.id)

    # Send confirmation email
    target_email = cust_email or (user.email if user else None)
    if target_email:
        background_tasks.add_task(
            send_order_confirmation_email,
            to_email=target_email,
            order_id=order.id,
            total_amount=order.total_amount,
            currency=order.currency,
            items_summary=items_summary
        )

    return build_order_schema(order)

# 5. Single-Input Public Order Tracking (/track)
@app.get("/api/shipping/track/{query}", response_model=schemas.OrderTrackingResponse)
def public_track_order(query: str, db: Session = Depends(get_db)):
    clean_query = query.strip()
    order = db.query(models.Order).options(selectinload(models.Order.items)).filter(
        (models.Order.id.ilike(clean_query)) |
        (models.Order.shiprocket_awb == clean_query) |
        (models.Order.reverse_awb == clean_query)
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order or tracking number not found.")

    # Live track AWB if present
    forward_scans = []
    if order.shiprocket_awb:
        track_info = shiprocket_service.track_awb(order.shiprocket_awb)
        raw_scans = track_info.get("scans") if isinstance(track_info, dict) else []
        if isinstance(raw_scans, list):
            forward_scans = [
                schemas.OrderTrackingScanSchema(
                    date=s.get("date"),
                    activity=str(s.get("activity", "")),
                    location=s.get("location")
                )
                for s in raw_scans
                if isinstance(s, dict)
            ]
    elif order.tracking_data and isinstance(order.tracking_data, dict) and "scans" in order.tracking_data:
        raw_scans = order.tracking_data.get("scans")
        if isinstance(raw_scans, list):
            forward_scans = [
                schemas.OrderTrackingScanSchema(
                    date=s.get("date"),
                    activity=str(s.get("activity", "")),
                    location=s.get("location")
                )
                for s in raw_scans
                if isinstance(s, dict)
            ]

    reverse_scans = []
    if order.reverse_awb:
        rev_info = shiprocket_service.track_awb(order.reverse_awb)
        raw_rev_scans = rev_info.get("scans") if isinstance(rev_info, dict) else []
        if isinstance(raw_rev_scans, list):
            reverse_scans = [
                schemas.OrderTrackingScanSchema(
                    date=s.get("date"),
                    activity=str(s.get("activity", "")),
                    location=s.get("location")
                )
                for s in raw_rev_scans
                if isinstance(s, dict)
            ]
    elif order.reverse_tracking_data and isinstance(order.reverse_tracking_data, dict) and "scans" in order.reverse_tracking_data:
        raw_rev_scans = order.reverse_tracking_data.get("scans")
        if isinstance(raw_rev_scans, list):
            reverse_scans = [
                schemas.OrderTrackingScanSchema(
                    date=s.get("date"),
                    activity=str(s.get("activity", "")),
                    location=s.get("location")
                )
                for s in raw_rev_scans
                if isinstance(s, dict)
            ]

    items_list = [
        {
            "id": i.id,
            "product_title": i.product_title,
            "variant_title": i.variant_title,
            "image_url": i.image_url,
            "quantity": i.quantity,
            "price_amount": i.price_amount
        }
        for i in (order.items or [])
    ]

    curr_location = None
    if forward_scans:
        curr_location = forward_scans[-1].location
    elif reverse_scans:
        curr_location = reverse_scans[-1].location
    if not curr_location and order.tracking_data and isinstance(order.tracking_data, dict):
        curr_location = order.tracking_data.get("current_location")

    is_picked_up_status = any("pick" in str(s.activity).lower() for s in (reverse_scans or forward_scans))

    return schemas.OrderTrackingResponse(
        order_id=order.id,
        status=order.status,
        shipping_status=order.shipping_status or "UNFULFILLED",
        courier_name=order.shiprocket_courier_name,
        awb_code=order.shiprocket_awb,
        tracking_url=order.tracking_url,
        scans=forward_scans,
        delivered_at=order.delivered_at.strftime("%b %d, %Y") if order.delivered_at else None,
        return_status=order.return_status or "NONE",
        reverse_awb=order.reverse_awb,
        reverse_courier_name=order.reverse_courier_name,
        reverse_scans=reverse_scans,
        items=items_list,
        current_location=curr_location,
        current_status=order.shipping_status or "UNFULFILLED",
        is_picked_up=is_picked_up_status,
        total_amount=order.total_amount,
        currency=order.currency or "INR",
        shipping_address=order.shipping_address,
        created_at=order.created_at.strftime("%b %d, %Y") if order.created_at else "",
        payment_status=order.payment_status or "PENDING",
        payment_method=order.payment_method or "ONLINE",
        cancellation_reason=order.cancellation_reason
    )

# 6. Authenticated Tracking for Customer Account View
@app.get("/api/orders/{order_id}/tracking", response_model=schemas.OrderTrackingResponse)
def get_order_tracking(
    order_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    # Ensure customer only accesses their own order
    if order.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized access to order tracking.")

    return public_track_order(query=order.id, db=db)

# 7. Customer Instant Cancellation Before Dispatch (Prepaid 100% Instant Refund)
@app.post("/api/orders/{order_id}/cancel", response_model=schemas.OrderSchema)
def cancel_order(
    order_id: str,
    payload: schemas.OrderCancelRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized.")

    if order.status != "PROCESSING" or order.shipping_status in ("PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"):
        raise HTTPException(status_code=400, detail="Order has already been dispatched with courier and cannot be self-cancelled. You may request a return or exchange within 10 days of delivery.")

    # Cancel courier shipment in Shiprocket
    shiprocket_service.cancel_shipment(awb_code=order.shiprocket_awb, order_id=order.shiprocket_order_id)

    # Disburse 100% instant refund via Razorpay API
    rfnd_id = None
    if order.razorpay_payment_id:
        try:
            rfnd_res = razorpay_service.initiate_refund(
                payment_id=order.razorpay_payment_id,
                amount_in_inr=order.total_amount,
                reason_note=payload.reason or "Customer self-cancellation before dispatch"
            )
            rfnd_id = rfnd_res.get("id")
        except Exception as e:
            logger.error(f"Refund call error on cancel: {e}")

    # Restock inventory
    for item in (order.items or []):
        if item.variant_id:
            var = db.query(models.ProductVariant).filter_by(id=item.variant_id).first()
            if var:
                var.inventory_quantity += item.quantity

    order.status = "CANCELLED"
    order.refund_status = "REFUNDED"
    order.refund_amount = order.total_amount
    order.refunded_at = datetime.utcnow()
    order.razorpay_refund_id = rfnd_id
    order.cancellation_reason = payload.reason
    order.shipping_status = "CANCELLED"
    db.commit()
    db.refresh(order)

    return build_order_schema(order)

# 7b. Retry Payment for an Unpaid / Failed Order
@app.post("/api/orders/{order_id}/retry-payment", response_model=schemas.OrderRetryPaymentResponse)
def retry_order_payment(
    order_id: str,
    current_user: Optional[models.User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    # Validation: Order must not already be captured
    if order.payment_status == "CAPTURED":
        raise HTTPException(status_code=400, detail="This order has already been paid for and confirmed.")

    # Validation: Order must not be cancelled
    if order.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="This order has been cancelled and cannot be retried.")

    # Authorization check if user is attached
    if order.user_id and current_user and order.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized access to this order.")

    # Validation: Verify stock availability for each item
    for item in (order.items or []):
        if item.variant_id:
            var = db.query(models.ProductVariant).filter_by(id=item.variant_id).first()
            if var and var.inventory_quantity < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot retry payment: '{var.title}' is currently out of stock (only {var.inventory_quantity} remaining)."
                )

    # Initialize a fresh Razorpay order for this retry
    receipt_id = f"REC-RETRY-{secrets.randbelow(899999) + 100000}"
    notes = {
        "order_id": order.id,
        "is_retry": "true",
        "user_email": order.guest_email or (current_user.email if current_user else ""),
    }

    retry_line_items = []
    for itm in (order.items or []):
        unit_price = float(itm.price_amount) if itm.price_amount is not None else 0.0
        retry_line_items.append({
            "sku": str(itm.variant_id or itm.id),
            "variant_id": str(itm.variant_id or itm.id),
            "price": int(round(unit_price * 100)),
            "offer_price": int(round(unit_price * 100)),
            "quantity": itm.quantity,
            "name": (itm.product_title or "VAHN Gear")[:255]
        })
    retry_line_items_total = int(round((order.subtotal_amount or order.total_amount) * 100))

    rzp_order = razorpay_service.create_order(
        amount_in_inr=order.total_amount,
        receipt_id=receipt_id,
        notes=notes,
        line_items=retry_line_items,
        line_items_total=retry_line_items_total
    )

    order.razorpay_order_id = rzp_order["id"]
    db.commit()

    shipping_addr = order.shipping_address or {}
    cust_name = order.guest_name or shipping_addr.get("name") or (current_user.full_name if current_user else "")
    cust_email = order.guest_email or shipping_addr.get("email") or (current_user.email if current_user else "")
    cust_phone = order.guest_phone or shipping_addr.get("phone") or (current_user.phone if current_user else "")

    return schemas.OrderRetryPaymentResponse(
        order_id=order.id,
        razorpay_order_id=rzp_order["id"],
        amount=rzp_order["amount"],
        currency=rzp_order.get("currency", "INR"),
        key_id=razorpay_service.get_key_id(),
        total_amount=order.total_amount,
        customer_name=cust_name,
        customer_email=cust_email,
        customer_phone=cust_phone
    )

# 7c. Confirm Retry Payment
@app.post("/api/orders/{order_id}/confirm-retry-payment", response_model=schemas.OrderSchema)
def confirm_retry_payment(
    order_id: str,
    payload: schemas.OrderConfirmRetryPaymentRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[models.User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.payment_status == "CAPTURED":
        return build_order_schema(order)

    # Verify cryptographic signature
    is_valid = razorpay_service.verify_payment_signature(
        razorpay_order_id=payload.razorpay_order_id,
        razorpay_payment_id=payload.razorpay_payment_id,
        razorpay_signature=payload.razorpay_signature
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail="Cryptographic payment signature verification failed.")

    # Decrement stock
    for item in (order.items or []):
        if item.variant_id:
            var = db.query(models.ProductVariant).filter_by(id=item.variant_id).first()
            if var:
                var.inventory_quantity = max(0, var.inventory_quantity - item.quantity)

    # Transition order state to PROCESSING & CAPTURED
    order.status = "PROCESSING"
    order.payment_status = "CAPTURED"
    order.razorpay_order_id = payload.razorpay_order_id
    order.razorpay_payment_id = payload.razorpay_payment_id
    order.razorpay_signature = payload.razorpay_signature
    order.cancellation_reason = None
    db.commit()
    db.refresh(order)

    # Dispatch Shiprocket shipment in background
    background_tasks.add_task(_async_create_shiprocket_order, order.id)

    # Send Order Confirmation Email
    target_email = order.guest_email or (current_user.email if current_user else None)
    if target_email:
        items_summary = ", ".join(f"{i.product_title} ({i.quantity}x)" for i in (order.items or []))
        background_tasks.add_task(
            send_order_confirmation_email,
            to_email=target_email,
            order_id=order.id,
            total_amount=order.total_amount,
            currency=order.currency,
            items_summary=items_summary
        )

    return build_order_schema(order)

# 7d. Cancel Pending / Failed Order
@app.post("/api/orders/{order_id}/cancel-pending")
def cancel_pending_order(
    order_id: str,
    payload: schemas.OrderCancelPendingRequest,
    current_user: Optional[models.User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.payment_status == "CAPTURED":
        raise HTTPException(status_code=400, detail="Order has already been paid for. Please use standard cancellation.")

    if order.status == "CANCELLED":
        return {"success": True, "message": "Order is already cancelled.", "order_id": order_id}

    order.status = "CANCELLED"
    order.cancellation_reason = payload.reason or "Customer abandoned or cancelled payment."
    db.commit()
    db.refresh(order)

    return {"success": True, "message": "Order cancelled successfully.", "order_id": order_id}

# 8. Customer 10-Day Return & Replacement / Exchange Options
@app.get("/api/orders/{order_id}/exchange-options", response_model=schemas.OrderExchangeOptionsResponse)
def get_order_exchange_options(
    order_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized.")

    items_res = []
    for item in (order.items or []):
        product_id = None
        current_var = None
        if item.variant_id:
            current_var = db.query(models.ProductVariant).filter_by(id=item.variant_id).first()
            if current_var:
                product_id = current_var.product_id

        # Find all sibling variants of the product
        sibling_variants = []
        if product_id:
            sibling_variants = db.query(models.ProductVariant).filter_by(product_id=product_id).all()
        elif item.product_title:
            prod = db.query(models.Product).options(selectinload(models.Product.variants)).filter_by(title=item.product_title).first()
            if prod:
                sibling_variants = prod.variants or []

        variant_opts = []
        for v in sibling_variants:
            size_label = v.title
            if v.selected_options and isinstance(v.selected_options, list):
                for opt in v.selected_options:
                    if isinstance(opt, dict) and opt.get("name", "").lower() == "size":
                        size_label = opt.get("value", v.title)
                        break

            in_stock = bool(v.available_for_sale and (v.inventory_quantity or 0) > 0)
            is_curr = bool(item.variant_id and v.id == item.variant_id)

            variant_opts.append(schemas.ExchangeVariantOption(
                variant_id=v.id,
                title=v.title,
                size=size_label,
                price=v.price_amount,
                inventory_quantity=v.inventory_quantity or 0,
                is_available=in_stock,
                is_current=is_curr
            ))

        items_res.append(schemas.ExchangeItemOption(
            item_id=item.id,
            product_title=item.product_title,
            current_variant_title=item.variant_title,
            current_variant_id=item.variant_id,
            image_url=item.image_url,
            quantity=item.quantity,
            variants=variant_opts
        ))

    return schemas.OrderExchangeOptionsResponse(
        order_id=order.id,
        items=items_res
    )

@app.post("/api/orders/{order_id}/return", response_model=schemas.OrderSchema)
def request_order_return(
    order_id: str,
    payload: schemas.OrderReturnRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized.")

    if order.status != "DELIVERED":
        raise HTTPException(status_code=400, detail="Returns or exchanges can only be requested after the order has been delivered.")

    # 10-day return & exchange window validation
    delivered_time = order.delivered_at or order.updated_at or order.created_at
    if (datetime.utcnow() - delivered_time).days > 10:
        raise HTTPException(status_code=400, detail="The 10-day return and exchange window for this order has expired.")

    if order.return_status and order.return_status != "NONE":
        raise HTTPException(status_code=400, detail=f"A return or exchange has already been requested for this order (Status: {order.return_status}).")

    is_replacement = (payload.action or "").upper() == "REPLACEMENT"

    if is_replacement:
        if not payload.replacement_variant_id:
            raise HTTPException(status_code=400, detail="Please select a replacement size/variant.")

        rep_variant = db.query(models.ProductVariant).filter_by(id=payload.replacement_variant_id).first()
        if not rep_variant:
            raise HTTPException(status_code=404, detail="Selected replacement variant not found.")

        if not rep_variant.available_for_sale or (rep_variant.inventory_quantity or 0) <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Selected size ({rep_variant.title}) is currently out of stock. Please select another available size or request a return for refund."
            )

        # Decrement stock for the replacement item
        rep_variant.inventory_quantity = max(0, (rep_variant.inventory_quantity or 0) - 1)

        order.return_type = "REPLACEMENT"
        order.replacement_variant_id = rep_variant.id
        order.replacement_variant_title = rep_variant.title
        order.replacement_status = "PICKUP_SCHEDULED"
        pickup_reason = f"Size Replacement: Exchange for {rep_variant.title} - {payload.reason}"
        scan_activity = f"Replacement Requested (Exchange for {rep_variant.title}) & Reverse Pickup Scheduled"
    else:
        order.return_type = "RETURN"
        order.replacement_status = "NONE"
        pickup_reason = payload.reason
        scan_activity = f"Return Requested ({payload.reason}) & Reverse Pickup Scheduled"

    # Automated Reverse Pickup Creation on Shiprocket
    rev_res = shiprocket_service.create_reverse_pickup(order, return_reason=pickup_reason)

    order.return_status = "PICKUP_SCHEDULED"
    order.return_reason = payload.reason
    order.return_notes = payload.notes
    order.return_requested_at = datetime.utcnow()
    order.reverse_shipment_id = rev_res.get("reverse_shipment_id")
    order.reverse_awb = rev_res.get("reverse_awb")
    order.reverse_courier_name = rev_res.get("reverse_courier_name")
    order.reverse_tracking_data = {
        "awb": rev_res.get("reverse_awb"),
        "courier_name": rev_res.get("reverse_courier_name"),
        "current_status": "PICKUP_SCHEDULED",
        "scans": [
            {
                "date": datetime.utcnow().strftime("%b %d, %Y - %I:%M %p"),
                "activity": scan_activity,
                "location": "Customer Address"
            }
        ]
    }
    db.commit()
    db.refresh(order)

    return build_order_schema(order)

# 9. Razorpay Webhook Handler
@app.post("/api/webhooks/razorpay")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    body_bytes = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    if not razorpay_service.verify_webhook_signature(body_bytes, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    try:
        data = json.loads(body_bytes.decode("utf-8"))
        event = data.get("event")
        payload = data.get("payload", {})

        if event in ("payment.captured", "order.paid"):
            payment_entity = payload.get("payment", {}).get("entity", {})
            rzp_order_id = payment_entity.get("order_id")
            rzp_payment_id = payment_entity.get("id")

            order = db.query(models.Order).filter_by(razorpay_order_id=rzp_order_id).first()
            if order and order.payment_status != "CAPTURED":
                order.payment_status = "CAPTURED"
                order.razorpay_payment_id = rzp_payment_id
                order.status = "PROCESSING"
                db.commit()

        elif event == "refund.processed":
            refund_entity = payload.get("refund", {}).get("entity", {})
            rzp_payment_id = refund_entity.get("payment_id")
            order = db.query(models.Order).filter_by(razorpay_payment_id=rzp_payment_id).first()
            if order:
                order.refund_status = "REFUNDED"
                order.refund_amount = float(refund_entity.get("amount", 0)) / 100.0
                order.refunded_at = datetime.utcnow()
                db.commit()

    except Exception as e:
        logger.error(f"Error processing Razorpay webhook: {e}")

    return {"status": "ok"}

# 10. Shiprocket Webhook Handler (Forward Tracking & Reverse Pickup Refund Trigger)
@app.post("/api/webhooks/shiprocket")
async def shiprocket_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        awb = str(data.get("awb", "")).strip()
        current_status = str(data.get("current_status", "")).upper()

        if not awb:
            return {"status": "ignored"}

        # Check forward shipment
        order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(shiprocket_awb=awb).first()
        if order:
            order.shipping_status = current_status
            if current_status == "DELIVERED":
                order.status = "DELIVERED"
                order.delivered_at = datetime.utcnow()
            db.commit()
            return {"status": "forward_updated"}

        # Check reverse shipment (AUTOMATED REFUND OR REPLACEMENT TRIGGER ON PICKUP)
        rev_order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(reverse_awb=awb).first()
        if rev_order:
            if current_status in ("PICKED_UP", "IN_TRANSIT"):
                if rev_order.return_type == "REPLACEMENT":
                    rev_order.return_status = "PICKED_UP"
                    if rev_order.replacement_status in ("NONE", "REQUESTED", "PICKUP_SCHEDULED"):
                        rev_order.replacement_status = "PICKED_UP"

                    # Restock returned inventory
                    for item in (rev_order.items or []):
                        if item.variant_id:
                            var = db.query(models.ProductVariant).filter_by(id=item.variant_id).first()
                            if var:
                                var.inventory_quantity += item.quantity

                    db.commit()
                    return {"status": "reverse_picked_up_replacement_ready"}
                elif rev_order.refund_status != "REFUNDED":
                    # Courier scanned parcel from customer -> Auto disburse refund immediately!
                    rfnd_id = None
                    if rev_order.razorpay_payment_id:
                        try:
                            rfnd_res = razorpay_service.initiate_refund(
                                payment_id=rev_order.razorpay_payment_id,
                                amount_in_inr=rev_order.total_amount,
                                reason_note="Automated refund upon reverse pickup scan"
                            )
                            rfnd_id = rfnd_res.get("id")
                        except Exception as e:
                            logger.error(f"Error disbursing auto refund on pickup: {e}")

                    rev_order.refund_status = "REFUNDED"
                    rev_order.refund_amount = rev_order.total_amount
                    rev_order.refunded_at = datetime.utcnow()
                    rev_order.razorpay_refund_id = rfnd_id
                    rev_order.return_status = "REFUND_INITIATED"

                    # Restock returned inventory
                    for item in (rev_order.items or []):
                        if item.variant_id:
                            var = db.query(models.ProductVariant).filter_by(id=item.variant_id).first()
                            if var:
                                var.inventory_quantity += item.quantity

                    db.commit()
                    return {"status": "reverse_picked_up_refunded"}

    except Exception as e:
        logger.error(f"Error in Shiprocket webhook: {e}")

    return {"status": "ok"}

@app.get("/api/orders", response_model=List[schemas.OrderSchema])
def get_user_orders(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(user_id=current_user.id).order_by(models.Order.created_at.desc()).all()
    return [build_order_schema(o) for o in orders]

@app.get("/api/orders/{order_id}", response_model=schemas.OrderSchema)
def get_order_detail(order_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized.")

    # Auto-fetch live tracking if AWB exists
    updated = False
    if order.shiprocket_awb and order.status != "CANCELLED":
        try:
            live_track = shiprocket_service.track_awb(order.shiprocket_awb)
            if live_track and isinstance(live_track, dict):
                order.tracking_data = live_track
                curr_st = live_track.get("current_status")
                if curr_st:
                    order.shipping_status = str(curr_st).upper()
                updated = True
        except Exception as e:
            logger.warning(f"Failed to sync forward tracking for order {order.id}: {e}")

    if order.reverse_awb:
        try:
            rev_track = shiprocket_service.track_awb(order.reverse_awb)
            if rev_track and isinstance(rev_track, dict):
                order.reverse_tracking_data = rev_track
                if rev_track.get("is_picked_up"):
                    if order.return_type == "REPLACEMENT":
                        if order.replacement_status in ("NONE", "REQUESTED", "PICKUP_SCHEDULED"):
                            order.replacement_status = "PICKED_UP"
                        order.return_status = "PICKED_UP"
                    elif order.return_status in ("NONE", "REQUESTED", "PICKUP_SCHEDULED"):
                        order.return_status = "PICKED_UP"
                updated = True
        except Exception as e:
            logger.warning(f"Failed to sync reverse tracking for order {order.id}: {e}")

    if updated:
        try:
            db.commit()
            db.refresh(order)
        except Exception:
            db.rollback()

    return build_order_schema(order)


# ============================================================
# ADMIN AUTH ROUTES (Email-OTP Flow — No UI registration, admin accounts seeded directly)
# ============================================================

@app.post("/api/admin/auth/check-email")
def admin_check_email(payload: schemas.AdminSendOTPRequest, db: Session = Depends(get_db)):
    """
    Check if an email address is registered as an admin.
    Returns {exists: bool, is_admin: bool}.
    """
    email = payload.email.strip().lower()
    user = db.query(models.User).filter(
        models.User.email == email,
        models.User.role == "admin"
    ).first()
    return {"exists": user is not None, "is_admin": user is not None}

@app.post("/api/admin/auth/check-phone")
def admin_check_phone(payload: schemas.PhoneLookupRequest, db: Session = Depends(get_db)):
    phone = normalize_phone(payload.phone)
    user = db.query(models.User).filter(
        models.User.phone == phone,
        models.User.role == "admin"
    ).first()
    return {"exists": user is not None, "is_admin": user is not None}

@app.post("/api/admin/auth/send-otp")
def admin_send_otp(payload: schemas.AdminSendOTPRequest, db: Session = Depends(get_db)):
    """
    Send login OTP to an admin email address.
    Admin accounts are NOT self-registerable — they must be seeded.
    Rate limited: max 3 per 10 min per email.
    """
    email = payload.email.strip().lower()
    check_rate_limit(email)

    user = db.query(models.User).filter(
        models.User.email == email,
        models.User.role == "admin"
    ).first()
    if not user:
        raise HTTPException(
            status_code=403,
            detail="This email address is not authorized for admin access. Contact the system administrator."
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Admin account is suspended.")

    otp = generate_6digit_otp()
    otp_token = create_otp_token(email, otp)
    send_otp_email(email, otp, subject="Your VAHN Admin Access Code")
    return {"otp_token": otp_token}

@app.post("/api/admin/auth/verify-otp", response_model=schemas.AuthResponse)
def admin_verify_otp(payload: schemas.AdminVerifyOTPRequest, db: Session = Depends(get_db)):
    """
    Verify admin OTP sent via Email. HMAC-signed token — OTP never stored in DB.
    On success: returns JWT token with role=admin.
    """
    email = payload.email.strip().lower()
    verify_otp_token(email, payload.otp_code, payload.otp_token)

    user = db.query(models.User).filter(
        models.User.email == email,
        models.User.role == "admin"
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin account not found.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Admin account is suspended.")

    user.is_verified = True
    user.email_verified = True
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email or "", role="admin")
    return schemas.AuthResponse(
        access_token=token,
        token_type="bearer",
        user=_user_schema(user)
    )

@app.get("/api/admin/auth/me")
def admin_me(admin: models.User = Depends(get_current_admin)):
    return {
        "id": admin.id,
        "email": admin.email,
        "full_name": admin.full_name,
        "role": admin.role,
        "is_verified": admin.is_verified
    }


# ============================================================
# ADMIN DASHBOARD
# ============================================================

@app.get("/api/admin/dashboard/stats", response_model=schemas.DashboardStatsSchema)
def admin_dashboard_stats(admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    total_orders = db.query(func.count(models.Order.id)).scalar() or 0
    total_revenue = db.query(func.sum(models.Order.total_amount)).scalar() or 0.0
    total_users = db.query(func.count(models.User.id)).filter(models.User.role == "customer").scalar() or 0
    total_products = db.query(func.count(models.Product.id)).scalar() or 0
    pending_orders = db.query(func.count(models.Order.id)).filter(models.Order.status == "PROCESSING").scalar() or 0

    recent_db_orders = db.query(models.Order).options(
        selectinload(models.Order.items),
        selectinload(models.Order.user)
    ).order_by(models.Order.created_at.desc()).limit(10).all()

    recent_orders = [
        schemas.RecentOrderItem(
            id=o.id,
            user_email=o.user.email if o.user else "",
            user_name=o.user.full_name if o.user else "",
            status=o.status,
            total_amount=o.total_amount,
            currency=o.currency,
            created_at=o.created_at.strftime("%b %d, %Y"),
            items_count=len(o.items)
        ) for o in recent_db_orders
    ]

    # Top products by revenue
    top_items = db.query(
        models.OrderItem.product_title,
        func.sum(models.OrderItem.quantity).label("total_sold"),
        func.sum(models.OrderItem.price_amount * models.OrderItem.quantity).label("total_revenue")
    ).group_by(models.OrderItem.product_title).order_by(func.sum(models.OrderItem.price_amount * models.OrderItem.quantity).desc()).limit(5).all()

    top_products = [
        schemas.TopProductItem(
            product_id=0,
            product_title=t.product_title,
            total_sold=int(t.total_sold or 0),
            total_revenue=float(t.total_revenue or 0)
        ) for t in top_items
    ]

    # Stock Alerts (inventory <= 5)
    low_stock_variants = db.query(models.ProductVariant).options(
        selectinload(models.ProductVariant.product)
    ).filter(models.ProductVariant.inventory_quantity <= 5).order_by(models.ProductVariant.inventory_quantity.asc()).limit(20).all()

    stock_alerts = [
        schemas.StockAlertItem(
            product_id=v.product_id,
            product_title=v.product.title if v.product else "Unknown Product",
            variant_id=str(v.id),
            variant_title=v.title or "Default",
            inventory_quantity=v.inventory_quantity,
            available_for_sale=v.available_for_sale,
            is_out_of_stock=(v.inventory_quantity <= 0 or not v.available_for_sale)
        ) for v in low_stock_variants
    ]

    return schemas.DashboardStatsSchema(
        total_orders=total_orders,
        total_revenue=float(total_revenue),
        total_users=total_users,
        total_products=total_products,
        pending_orders=pending_orders,
        recent_orders=recent_orders,
        top_products=top_products,
        stock_alerts=stock_alerts
    )


# ============================================================
# ADMIN PRODUCTS CRUD
# ============================================================

@app.get("/api/admin/products")
def admin_list_products(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    available_only: Optional[bool] = None,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.Product).options(
        selectinload(models.Product.variants)
    )
    if search:
        q = q.filter(models.Product.title.ilike(f"%{search}%"))
    if available_only is not None:
        q = q.filter(models.Product.available_for_sale == available_only)

    total = q.count()
    products = q.order_by(models.Product.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = [
        schemas.AdminProductSummary(
            id=p.id,
            title=p.title,
            handle=p.handle,
            vendor=p.vendor,
            available_for_sale=p.available_for_sale,
            product_type=p.product_type,
            featured_image_url=p.featured_image_url,
            tags=p.tags or [],
            fit=p.fit,
            kit_type=p.kit_type,
            activity=p.activity,
            gst_percent=p.gst_percent if p.gst_percent is not None else 12.0,
            shipping_rate=p.shipping_rate,
            variants_count=len(p.variants),
            created_at=p.created_at.strftime("%b %d, %Y") if p.created_at else None
        ) for p in products
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": (total + page_size - 1) // page_size}

@app.post("/api/admin/products", response_model=schemas.AdminProductDetail)
def admin_create_product(
    payload: schemas.ProductCreateRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(models.Product).filter_by(handle=payload.handle).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Product handle '{payload.handle}' already exists.")

    product = models.Product(
        title=payload.title,
        handle=payload.handle,
        description=payload.description or "",
        description_html=payload.description_html or "",
        vendor=payload.vendor or "VAHN",
        product_type=payload.product_type or "",
        tags=payload.tags or [],
        available_for_sale=payload.available_for_sale,
        options=[o.dict() for o in payload.options],
        featured_image_url=payload.featured_image_url,
        featured_image_alt=payload.featured_image_alt,
        images=payload.images or [],
        lookbook=[l.dict() for l in payload.lookbook],
        fit=payload.fit,
        kit_type=payload.kit_type,
        activity=payload.activity,
        gst_percent=payload.gst_percent,
        shipping_rate=payload.shipping_rate,
        size_guide_type_ids=payload.size_guide_type_ids or [],
        size_fit_details=payload.size_fit_details,
        care_instructions=payload.care_instructions,
        product_details=payload.product_details
    )
    db.add(product)
    db.flush()

    # Automatically attach product to existing collections so it appears on storefront immediately
    collections = db.query(models.Collection).all()
    for coll in collections:
        coll.products.append(product)

    for v in payload.variants:
        variant = models.ProductVariant(
            id=f"var-{product.id}-{uuid.uuid4().hex[:8]}",
            product_id=product.id,
            title=v.title,
            available_for_sale=v.available_for_sale,
            price_amount=v.price_amount,
            compare_at_price_amount=v.compare_at_price_amount,
            inventory_quantity=v.inventory_quantity,
            image_url=v.image_url,
            selected_options=[o.dict() for o in v.selected_options]
        )
        db.add(variant)

    db.commit()
    db.refresh(product)
    return _admin_product_detail(product)

@app.get("/api/admin/products/{product_id}", response_model=schemas.AdminProductDetail)
def admin_get_product(
    product_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    product = db.query(models.Product).options(
        selectinload(models.Product.variants),
        selectinload(models.Product.colour_groups)
    ).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _admin_product_detail(product)

@app.put("/api/admin/products/{product_id}", response_model=schemas.AdminProductDetail)
def admin_update_product(
    product_id: int,
    payload: schemas.ProductUpdateRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    product = db.query(models.Product).options(
        selectinload(models.Product.variants),
        selectinload(models.Product.colour_groups)
    ).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    updates = payload.dict(exclude_unset=True)
    for k, v in updates.items():
        if k == "options" and v is not None:
            setattr(product, k, [o if isinstance(o, dict) else o.dict() for o in v])
        elif k == "lookbook" and v is not None:
            setattr(product, k, [i if isinstance(i, dict) else i.dict() for i in v])
        else:
            setattr(product, k, v)

    db.commit()
    db.refresh(product)
    return _admin_product_detail(product)

@app.delete("/api/admin/products/{product_id}")
def admin_delete_product(
    product_id: int,
    hard_delete: bool = False,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    product = db.query(models.Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if hard_delete:
        # Collect all S3 images associated with this product
        s3_images_to_delete = []
        if product.featured_image_url:
            s3_images_to_delete.append(product.featured_image_url)
        if product.images and isinstance(product.images, list):
            for img in product.images:
                if isinstance(img, dict) and img.get("url"):
                    s3_images_to_delete.append(img["url"])
                elif isinstance(img, str):
                    s3_images_to_delete.append(img)
        if product.lookbook and isinstance(product.lookbook, list):
            for item in product.lookbook:
                if isinstance(item, dict) and item.get("imageUrl"):
                    s3_images_to_delete.append(item["imageUrl"])
        for group in (product.colour_groups or []):
            if group.images and isinstance(group.images, list):
                for g_img in group.images:
                    if isinstance(g_img, dict) and g_img.get("url"):
                        s3_images_to_delete.append(g_img["url"])
                    elif isinstance(g_img, str):
                        s3_images_to_delete.append(g_img)
            if group.lookbook and isinstance(group.lookbook, list):
                for lb_item in group.lookbook:
                    if isinstance(lb_item, dict) and (lb_item.get("imageUrl") or lb_item.get("image_url")):
                        s3_images_to_delete.append(lb_item.get("imageUrl") or lb_item.get("image_url"))
        for variant in (product.variants or []):
            if variant.image_url:
                s3_images_to_delete.append(variant.image_url)

        # Permanently delete files from AWS S3
        storage.delete_files(s3_images_to_delete)

        db.delete(product)
        db.commit()
        return {"message": "Product and associated media permanently deleted."}
    else:
        product.available_for_sale = False
        db.commit()
        return {"message": "Product deactivated (hidden from storefront)."}

def _admin_product_detail(product: models.Product) -> schemas.AdminProductDetail:
    return schemas.AdminProductDetail(
        id=product.id,
        title=product.title,
        handle=product.handle,
        description=product.description,
        description_html=product.description_html,
        vendor=product.vendor,
        product_type=product.product_type,
        tags=product.tags or [],
        available_for_sale=product.available_for_sale,
        options=product.options or [],
        featured_image_url=product.featured_image_url,
        featured_image_alt=product.featured_image_alt,
        images=product.images or [],
        lookbook=product.lookbook or [],
        fit=product.fit,
        kit_type=product.kit_type,
        activity=product.activity,
        gst_percent=product.gst_percent if product.gst_percent is not None else 12.0,
        shipping_rate=product.shipping_rate,
        size_guide_type_ids=product.size_guide_type_ids or [],
        size_fit_details=product.size_fit_details,
        care_instructions=product.care_instructions,
        product_details=product.product_details,
        variants=[

            schemas.AdminVariantSchema(
                id=v.id,
                title=v.title,
                available_for_sale=v.available_for_sale,
                price_amount=v.price_amount,
                price_currency=v.price_currency,
                compare_at_price_amount=v.compare_at_price_amount,
                inventory_quantity=v.inventory_quantity,
                image_url=v.image_url,
                selected_options=v.selected_options or []
            ) for v in (product.variants or [])
        ],
        colour_groups=[
            schemas.ColourGroupSchema(
                id=cg.id,
                product_id=cg.product_id,
                colour_value=cg.colour_value,
                images=cg.images or [],
                lookbook=cg.lookbook or [],
                display_order=cg.display_order
            ) for cg in (product.colour_groups or [])
        ],
        created_at=product.created_at.strftime("%b %d, %Y") if product.created_at else None,
        updated_at=product.updated_at.strftime("%b %d, %Y") if product.updated_at else None
    )


# ============================================================
# ADMIN VARIANT CRUD
# ============================================================

@app.post("/api/admin/products/{product_id}/variants", response_model=schemas.AdminVariantSchema)
def admin_add_variant(
    product_id: int,
    payload: schemas.VariantCreateRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    product = db.query(models.Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    variant = models.ProductVariant(
        id=f"var-{product_id}-{uuid.uuid4().hex[:8]}",
        product_id=product_id,
        title=payload.title,
        available_for_sale=payload.available_for_sale,
        price_amount=payload.price_amount,
        compare_at_price_amount=payload.compare_at_price_amount,
        inventory_quantity=payload.inventory_quantity,
        image_url=payload.image_url,
        selected_options=[o.dict() for o in payload.selected_options]
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return schemas.AdminVariantSchema(
        id=variant.id, title=variant.title, available_for_sale=variant.available_for_sale,
        price_amount=variant.price_amount, price_currency=variant.price_currency,
        compare_at_price_amount=variant.compare_at_price_amount,
        inventory_quantity=variant.inventory_quantity, image_url=variant.image_url,
        selected_options=variant.selected_options or []
    )

@app.put("/api/admin/products/{product_id}/variants/{variant_id:path}", response_model=schemas.AdminVariantSchema)
def admin_update_variant(
    product_id: int,
    variant_id: str,
    payload: schemas.VariantUpdateRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    variant = db.query(models.ProductVariant).filter_by(id=variant_id).first()
    if not variant:
        variant = db.query(models.ProductVariant).filter_by(product_id=product_id, id=variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail=f"Variant '{variant_id}' not found for product {product_id}")

    updates = payload.dict(exclude_unset=True)
    for k, v in updates.items():
        if k == "selected_options" and v is not None:
            setattr(variant, k, [o if isinstance(o, dict) else o.dict() for o in v])
        else:
            setattr(variant, k, v)

    db.commit()
    db.refresh(variant)

    if variant.inventory_quantity > 0 and variant.available_for_sale:
        colour_val = ""
        for opt in (variant.selected_options or []):
            opt_dict = opt if isinstance(opt, dict) else (opt.dict() if hasattr(opt, 'dict') else {})
            if opt_dict.get("name", "").lower() in ["colour", "color"]:
                colour_val = opt_dict.get("value", "")
                break
        notify_restock_subscribers(db, product_id, colour_val, variant.id)

    return schemas.AdminVariantSchema(
        id=variant.id, title=variant.title, available_for_sale=variant.available_for_sale,
        price_amount=variant.price_amount, price_currency=variant.price_currency,
        compare_at_price_amount=variant.compare_at_price_amount,
        inventory_quantity=variant.inventory_quantity, image_url=variant.image_url,
        selected_options=variant.selected_options or []
    )

@app.delete("/api/admin/products/{product_id}/variants/{variant_id:path}")
def admin_delete_variant(
    product_id: int,
    variant_id: str,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    variant = db.query(models.ProductVariant).filter_by(id=variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    db.delete(variant)
    db.commit()
    return {"message": "Variant deleted."}


# ============================================================
# ADMIN COLOUR GROUPS CRUD
# ============================================================

@app.get("/api/admin/products/{product_id}/colour-groups")
def admin_list_colour_groups(
    product_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    groups = db.query(models.ProductColourGroup).filter_by(product_id=product_id).order_by(models.ProductColourGroup.display_order).all()
    return [schemas.ColourGroupSchema(id=g.id, product_id=g.product_id, colour_value=g.colour_value, images=g.images or [], lookbook=g.lookbook or [], display_order=g.display_order) for g in groups]

@app.post("/api/admin/products/{product_id}/colour-groups", response_model=schemas.ColourGroupSchema)
def admin_create_colour_group(
    product_id: int,
    payload: schemas.ColourGroupCreateRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    product = db.query(models.Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    group = models.ProductColourGroup(
        product_id=product_id,
        colour_value=payload.colour_value,
        images=payload.images,
        lookbook=payload.lookbook or [],
        display_order=payload.display_order
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return schemas.ColourGroupSchema(id=group.id, product_id=group.product_id, colour_value=group.colour_value, images=group.images or [], lookbook=group.lookbook or [], display_order=group.display_order)

@app.put("/api/admin/products/{product_id}/colour-groups/{group_id}", response_model=schemas.ColourGroupSchema)
def admin_update_colour_group(
    product_id: int,
    group_id: int,
    payload: schemas.ColourGroupUpdateRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    group = db.query(models.ProductColourGroup).filter_by(id=group_id, product_id=product_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Colour group not found")
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(group, k, v)
    db.commit()
    db.refresh(group)
    return schemas.ColourGroupSchema(id=group.id, product_id=group.product_id, colour_value=group.colour_value, images=group.images or [], lookbook=group.lookbook or [], display_order=group.display_order)

@app.delete("/api/admin/products/{product_id}/colour-groups/{group_id}")
def admin_delete_colour_group(
    product_id: int,
    group_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    group = db.query(models.ProductColourGroup).filter_by(id=group_id, product_id=product_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Colour group not found")

    colour_val = group.colour_value.strip().lower() if group.colour_value else ""

    # Collect images to delete from AWS S3
    images_to_delete = []
    if group.images and isinstance(group.images, list):
        for img in group.images:
            if isinstance(img, dict) and img.get("url"):
                images_to_delete.append(img["url"])
            elif isinstance(img, str):
                images_to_delete.append(img)
    if group.lookbook and isinstance(group.lookbook, list):
        for item in group.lookbook:
            if isinstance(item, dict) and (item.get("imageUrl") or item.get("image_url")):
                images_to_delete.append(item.get("imageUrl") or item.get("image_url"))

    # Cascade-delete all variants associated with this colour
    if colour_val:
        variants = db.query(models.ProductVariant).filter_by(product_id=product_id).all()
        for v in variants:
            is_match = False
            if v.selected_options and isinstance(v.selected_options, list):
                for opt in v.selected_options:
                    if isinstance(opt, dict) and opt.get("name", "").lower() in ["colour", "color"]:
                        if str(opt.get("value", "")).strip().lower() == colour_val:
                            is_match = True
                            break
            if not is_match and v.title:
                parts = v.title.split("/")
                if len(parts) > 0 and parts[0].strip().lower() == colour_val:
                    is_match = True
            
            if is_match:
                if v.image_url:
                    images_to_delete.append(v.image_url)
                db.delete(v)

    if images_to_delete:
        storage.delete_files(images_to_delete)

    db.delete(group)
    db.commit()
    return {"message": "Colour group, associated variants, and media deleted."}


# ============================================================
# ADMIN COLLECTIONS CRUD
# ============================================================

@app.get("/api/admin/collections")
def admin_list_collections(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.Collection).options(selectinload(models.Collection.products))
    if search:
        q = q.filter(models.Collection.title.ilike(f"%{search}%"))
    total = q.count()
    collections = q.offset((page - 1) * page_size).limit(page_size).all()
    items = [
        schemas.AdminCollectionSchema(
            id=c.id,
            title=c.title,
            handle=c.handle,
            description=c.description,
            image_url=c.image_url,
            products_count=len(c.products)
        ) for c in collections
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": (total + page_size - 1) // page_size}

@app.post("/api/admin/collections")
def admin_create_collection(
    payload: schemas.CollectionCreateRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(models.Collection).filter_by(handle=payload.handle).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Collection handle '{payload.handle}' already exists.")
    col = models.Collection(
        title=payload.title,
        handle=payload.handle,
        description=payload.description,
        description_html=payload.description_html,
        image_url=payload.image_url,
        image_alt=payload.image_alt
    )
    db.add(col)
    db.commit()
    db.refresh(col)
    return {"id": col.id, "handle": col.handle, "title": col.title, "message": "Collection created."}

@app.put("/api/admin/collections/{collection_id}")
def admin_update_collection(
    collection_id: int,
    payload: schemas.CollectionUpdateRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    col = db.query(models.Collection).filter_by(id=collection_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(col, k, v)
    db.commit()
    db.refresh(col)
    return {"id": col.id, "handle": col.handle, "title": col.title, "message": "Collection updated."}

@app.delete("/api/admin/collections/{collection_id}")
def admin_delete_collection(
    collection_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    col = db.query(models.Collection).filter_by(id=collection_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Delete image from AWS S3
    if col.image_url:
        storage.delete_file(col.image_url)

    db.delete(col)
    db.commit()
    return {"message": "Collection deleted."}

@app.post("/api/admin/collections/{collection_id}/products")
def admin_manage_collection_products(
    collection_id: int,
    payload: schemas.CollectionProductsUpdateRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    col = db.query(models.Collection).options(selectinload(models.Collection.products)).filter_by(id=collection_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")

    products = db.query(models.Product).filter(models.Product.id.in_(payload.product_ids)).all()
    if payload.action == "attach":
        for p in products:
            if p not in col.products:
                col.products.append(p)
    elif payload.action == "detach":
        for p in products:
            if p in col.products:
                col.products.remove(p)
    db.commit()
    return {"message": f"{len(products)} product(s) {payload.action}ed successfully."}


# ============================================================
# ADMIN ORDERS MANAGEMENT
# ============================================================

@app.get("/api/admin/orders")
def admin_list_orders(
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    shipping_status: Optional[str] = None,
    return_status: Optional[str] = None,
    payment_status: Optional[str] = None,
    search: Optional[str] = None,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.Order).options(
        selectinload(models.Order.items),
        selectinload(models.Order.user)
    )
    if status:
        q = q.filter(models.Order.status == status)
    if shipping_status:
        q = q.filter(models.Order.shipping_status == shipping_status)
    if return_status:
        if return_status in ("ANY", "ACTIVE", "RETURN_REQUESTED"):
            q = q.filter(models.Order.return_status.isnot(None), models.Order.return_status != "NONE")
        else:
            q = q.filter(models.Order.return_status == return_status)
    if payment_status:
        q = q.filter(models.Order.payment_status == payment_status)
    if search:
        search_filter = f"%{search}%"
        q = q.outerjoin(models.User).filter(
            (models.Order.id.ilike(search_filter)) |
            (models.Order.guest_email.ilike(search_filter)) |
            (models.Order.guest_name.ilike(search_filter)) |
            (models.Order.guest_phone.ilike(search_filter)) |
            (models.Order.shiprocket_awb.ilike(search_filter)) |
            (models.Order.razorpay_payment_id.ilike(search_filter)) |
            (models.User.email.ilike(search_filter)) |
            (models.User.full_name.ilike(search_filter)) |
            (models.User.phone.ilike(search_filter))
        )
    total = q.count()
    orders = q.order_by(models.Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [
        schemas.AdminOrderSummary(
            id=o.id,
            status=o.status,
            refund_status=o.refund_status,
            total_amount=o.total_amount,
            currency=o.currency,
            created_at=o.created_at.strftime("%b %d, %Y") if o.created_at else "",
            is_guest=bool(o.is_guest),
            user_email=o.guest_email if o.is_guest else (o.user.email if o.user else ""),
            user_name=o.guest_name if o.is_guest else (o.user.full_name if o.user else ""),
            user_phone=o.guest_phone if o.is_guest else ((o.shipping_address or {}).get("phone") if isinstance(o.shipping_address, dict) else ""),
            payment_method=o.payment_method or "ONLINE",
            payment_status=o.payment_status or "PENDING",
            shipping_status=o.shipping_status or "UNFULFILLED",
            shiprocket_awb=o.shiprocket_awb,
            return_status=o.return_status or "NONE",
            return_type=o.return_type or "RETURN",
            replacement_status=o.replacement_status or "NONE",
            replacement_variant_title=o.replacement_variant_title,
            items_count=len(o.items or [])
        ) for o in orders
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": (total + page_size - 1) // page_size}

@app.get("/api/admin/orders/{order_id}", response_model=schemas.AdminOrderSchema)
def admin_get_order(
    order_id: str,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).options(
        selectinload(models.Order.items),
        selectinload(models.Order.user)
    ).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    updated = False
    # Auto-fetch live forward tracking if AWB exists
    if order.shiprocket_awb:
        try:
            live_track = shiprocket_service.track_awb(order.shiprocket_awb)
            if live_track and isinstance(live_track, dict):
                order.tracking_data = live_track
                curr_st = live_track.get("current_status")
                if curr_st:
                    order.shipping_status = str(curr_st).upper()
                updated = True
        except Exception as e:
            logger.warning(f"Failed to sync forward tracking for order {order.id}: {e}")

    # Auto-fetch live reverse return tracking if reverse AWB exists
    if order.reverse_awb:
        try:
            rev_track = shiprocket_service.track_awb(order.reverse_awb)
            if rev_track and isinstance(rev_track, dict):
                order.reverse_tracking_data = rev_track
                updated = True
        except Exception as e:
            logger.warning(f"Failed to sync reverse tracking for order {order.id}: {e}")

    if updated:
        try:
            db.commit()
            db.refresh(order)
        except Exception:
            db.rollback()

    return _admin_order_detail(order)

@app.post("/api/admin/orders/{order_id}/refresh-tracking", response_model=schemas.AdminOrderSchema)
def admin_refresh_order_tracking(
    order_id: str,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).options(
        selectinload(models.Order.items),
        selectinload(models.Order.user)
    ).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.shiprocket_awb:
        try:
            live_track = shiprocket_service.track_awb(order.shiprocket_awb)
            if live_track and isinstance(live_track, dict):
                order.tracking_data = live_track
                if live_track.get("current_status"):
                    order.shipping_status = str(live_track["current_status"]).upper()
        except Exception as e:
            logger.warning(f"Error refreshing tracking for order {order.id}: {e}")

    if order.reverse_awb:
        try:
            rev_track = shiprocket_service.track_awb(order.reverse_awb)
            if rev_track and isinstance(rev_track, dict):
                order.reverse_tracking_data = rev_track
        except Exception as e:
            logger.warning(f"Error refreshing reverse tracking for order {order.id}: {e}")

    try:
        db.commit()
        db.refresh(order)
    except Exception:
        db.rollback()

    return _admin_order_detail(order)

@app.put("/api/admin/orders/{order_id}/status")
def admin_update_order_status(
    order_id: str,
    payload: schemas.OrderStatusUpdateRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    previous_status = order.status
    previous_refund_status = order.refund_status

    if payload.status:
        order.status = payload.status
    if payload.refund_status is not None:
        order.refund_status = payload.refund_status
    if payload.refund_note is not None:
        order.refund_note = payload.refund_note

    # Automatic stock replenishment if order is cancelled or refunded
    if (payload.status == "CANCELLED" and previous_status != "CANCELLED") or (payload.refund_status == "REFUNDED" and previous_refund_status != "REFUNDED"):
        for item in (order.items or []):
            if item.variant_id:
                var = db.query(models.ProductVariant).filter_by(id=item.variant_id).first()
                if var:
                    var.inventory_quantity += item.quantity

    db.commit()
    return {"message": "Order updated.", "order_id": order_id, "status": order.status}

@app.post("/api/admin/orders/{order_id}/ship")
def admin_ship_order(
    order_id: str,
    pickup_location: Optional[str] = None,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in ["CANCELLED", "REFUNDED"]:
        raise HTTPException(status_code=400, detail=f"Cannot ship order with status {order.status}")
    
    # 1. Check if shipment already created in Shiprocket
    if not order.shiprocket_shipment_id:
        sr_order = shiprocket_service.create_forward_shipment(order, pickup_location=pickup_location)
        order.shiprocket_order_id = sr_order.get("order_id")
        order.shiprocket_shipment_id = sr_order.get("shipment_id")

    # 2. Generate AWB
    awb_res = shiprocket_service.generate_awb(order.shiprocket_shipment_id)
    order.shiprocket_awb = awb_res.get("awb_code")
    order.shiprocket_courier_name = awb_res.get("courier_name")
    order.tracking_url = f"/track?q={order.shiprocket_awb}"
    order.shipping_status = "SHIPPED"
    if order.status == "PROCESSING":
        order.status = "SHIPPED"
    db.commit()
    return {
        "message": "Shipment initiated successfully",
        "order_id": order.id,
        "shiprocket_shipment_id": order.shiprocket_shipment_id,
        "awb_code": order.shiprocket_awb,
        "courier_name": order.shiprocket_courier_name,
        "shipping_status": order.shipping_status
    }

@app.get("/api/admin/orders/{order_id}/label")
def admin_get_shipping_label(
    order_id: str,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not order.shiprocket_shipment_id:
        raise HTTPException(status_code=400, detail="Shipment has not been created for this order")
    label_res = shiprocket_service.generate_label(order.shiprocket_shipment_id)
    return label_res

@app.post("/api/admin/orders/{order_id}/refund")
def admin_refund_order(
    order_id: str,
    payload: schemas.AdminInitiateRefundRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.refund_status == "REFUNDED":
        raise HTTPException(status_code=400, detail="Order is already fully refunded")
    
    refund_amount = payload.amount if payload.amount is not None else order.total_amount
    refund_res = razorpay_service.refund_payment(
        payment_id=order.razorpay_payment_id,
        amount=refund_amount,
        notes={"order_id": order.id, "reason": payload.reason or "Admin initiated refund"}
    )

    order.refund_status = "REFUNDED"
    order.refund_amount = (order.refund_amount or 0.0) + refund_amount
    order.refund_note = payload.reason
    order.refunded_at = datetime.utcnow()
    order.status = "REFUNDED"
    order.razorpay_refund_id = refund_res.get("refund_id")

    if payload.restock_items:
        for item in (order.items or []):
            if item.variant_id:
                var = db.query(models.ProductVariant).filter_by(id=item.variant_id).first()
                if var:
                    var.inventory_quantity += item.quantity

    db.commit()
    return {
        "message": f"Refund of INR {refund_amount:.2f} processed successfully",
        "refund_id": order.razorpay_refund_id,
        "order_id": order.id,
        "refund_status": order.refund_status
    }

def _admin_order_detail(order: models.Order) -> schemas.AdminOrderSchema:
    user_email = order.guest_email if order.is_guest else (order.user.email if order.user else "")
    user_name = order.guest_name if order.is_guest else (order.user.full_name if order.user else "")
    return schemas.AdminOrderSchema(
        id=order.id,
        status=order.status,
        refund_status=order.refund_status,
        refund_note=order.refund_note,
        refund_amount=order.refund_amount or 0.0,
        refunded_at=order.refunded_at.strftime("%Y-%m-%dT%H:%M:%S") if order.refunded_at else None,
        cancellation_reason=order.cancellation_reason,
        subtotal_amount=order.subtotal_amount,
        shipping_amount=order.shipping_amount or 0.0,
        tax_amount=order.tax_amount or 0.0,
        discount_amount=order.discount_amount or 0.0,
        total_amount=order.total_amount,
        currency=order.currency,
        shipping_address=order.shipping_address,
        created_at=order.created_at.strftime("%Y-%m-%dT%H:%M:%S") if order.created_at else "",
        updated_at=order.updated_at.strftime("%Y-%m-%dT%H:%M:%S") if order.updated_at else None,
        is_guest=bool(order.is_guest),
        guest_name=order.guest_name,
        guest_email=order.guest_email,
        guest_phone=order.guest_phone,
        user_id=order.user.id if order.user else (order.user_id or None),
        user_email=user_email,
        user_name=user_name,
        payment_method=order.payment_method or "ONLINE",
        payment_status=order.payment_status or "PENDING",
        razorpay_order_id=order.razorpay_order_id,
        razorpay_payment_id=order.razorpay_payment_id,
        razorpay_refund_id=order.razorpay_refund_id,
        shiprocket_order_id=order.shiprocket_order_id,
        shiprocket_shipment_id=order.shiprocket_shipment_id,
        shiprocket_awb=order.shiprocket_awb,
        shiprocket_courier_name=order.shiprocket_courier_name,
        shipping_status=order.shipping_status or "UNFULFILLED",
        tracking_url=order.tracking_url,
        tracking_data=order.tracking_data,
        delivered_at=order.delivered_at.strftime("%Y-%m-%dT%H:%M:%S") if order.delivered_at else None,
        return_status=order.return_status or "NONE",
        return_type=order.return_type or "RETURN",
        return_reason=order.return_reason,
        return_notes=order.return_notes,
        return_requested_at=order.return_requested_at.strftime("%Y-%m-%dT%H:%M:%S") if order.return_requested_at else None,
        reverse_shipment_id=order.reverse_shipment_id,
        reverse_awb=order.reverse_awb,
        reverse_courier_name=order.reverse_courier_name,
        reverse_tracking_data=order.reverse_tracking_data,
        replacement_variant_id=order.replacement_variant_id,
        replacement_variant_title=order.replacement_variant_title,
        replacement_status=order.replacement_status or "NONE",
        replacement_shipment_id=order.replacement_shipment_id,
        replacement_awb=order.replacement_awb,
        replacement_courier_name=order.replacement_courier_name,
        replacement_tracking_url=order.replacement_tracking_url,
        items=[
            schemas.AdminOrderItemSchema(
                id=i.id,
                variant_id=i.variant_id,
                product_title=i.product_title,
                variant_title=i.variant_title,
                image_url=i.image_url,
                price_amount=i.price_amount,
                quantity=i.quantity
            ) for i in (order.items or [])
        ]
    )

@app.post("/api/admin/orders/{order_id}/dispatch-replacement", response_model=schemas.AdminOrderSchema)
def dispatch_order_replacement(
    order_id: str,
    payload: schemas.AdminDispatchReplacementRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.return_type != "REPLACEMENT":
        raise HTTPException(status_code=400, detail="This order is not a size exchange / replacement request.")

    order.replacement_status = "REPLACEMENT_DISPATCHED"
    if payload.awb_code:
        order.replacement_awb = payload.awb_code
    if payload.courier_name:
        order.replacement_courier_name = payload.courier_name
    if payload.tracking_url:
        order.replacement_tracking_url = payload.tracking_url

    db.commit()
    db.refresh(order)
    return _admin_order_detail(order)


# ============================================================
# ADMIN LOGISTICS & WAREHOUSE MANAGEMENT
# ============================================================

@app.get("/api/admin/logistics/warehouses", response_model=List[schemas.WarehouseLocationResponse])
def admin_list_warehouses(admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Lists all pickup/warehouse locations and auto-syncs with Shiprocket."""
    try:
        sr_locations = shiprocket_service.fetch_shiprocket_pickup_locations()
        for loc in sr_locations:
            loc_name = loc.get("pickup_location")
            if loc_name:
                existing = db.query(models.WarehouseLocation).filter_by(pickup_location=loc_name).first()
                if not existing:
                    new_wh = models.WarehouseLocation(
                        pickup_location=loc_name,
                        name=loc.get("name") or "Warehouse Contact",
                        email=loc.get("email") or admin.email or "logistics@vahnsports.com",
                        phone=loc.get("phone") or "9876543210",
                        address=loc.get("address") or "Fulfillment Hub",
                        address_2=loc.get("address_2") or "",
                        city=loc.get("city") or "New Delhi",
                        state=loc.get("state") or "Delhi",
                        country=loc.get("country") or "India",
                        pin_code=str(loc.get("pin_code") or "110016"),
                        is_primary=bool(loc.get("is_primary_location")),
                        shiprocket_pickup_id=str(loc.get("id", ""))
                    )
                    db.add(new_wh)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning(f"Error syncing warehouses from Shiprocket: {e}")

    warehouses = db.query(models.WarehouseLocation).order_by(models.WarehouseLocation.is_primary.desc(), models.WarehouseLocation.created_at.desc()).all()
    if not warehouses:
        default_wh = models.WarehouseLocation(
            pickup_location="Primary",
            name="VAHN Warehouse Manager",
            email=admin.email or "logistics@vahnsports.com",
            phone="9876543210",
            address="VAHN Central Fulfillment Facility",
            address_2="",
            city="Mumbai",
            state="Maharashtra",
            country="India",
            pin_code="400001",
            is_primary=True
        )
        db.add(default_wh)
        db.commit()
        db.refresh(default_wh)
        warehouses = [default_wh]

    return warehouses

@app.post("/api/admin/logistics/warehouses", response_model=schemas.WarehouseLocationResponse)
def admin_create_warehouse(
    payload: schemas.WarehouseLocationCreate,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    clean_loc = payload.pickup_location.strip()
    existing = db.query(models.WarehouseLocation).filter_by(pickup_location=clean_loc).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"A warehouse with location nickname '{clean_loc}' already exists.")

    sr_pickup_id = None
    try:
        sr_res = shiprocket_service.add_warehouse_to_shiprocket(payload.dict())
        sr_pickup_id = str(sr_res.get("address_id") or sr_res.get("id", ""))
    except Exception as e:
        logger.warning(f"Notice: Warehouse registered in DB; Shiprocket API registration note: {e}")

    is_first = db.query(models.WarehouseLocation).count() == 0
    make_primary = payload.is_primary or is_first

    if make_primary:
        db.query(models.WarehouseLocation).update({models.WarehouseLocation.is_primary: False})

    wh = models.WarehouseLocation(
        pickup_location=clean_loc,
        name=payload.name.strip(),
        email=payload.email.strip(),
        phone=payload.phone.strip(),
        address=payload.address.strip(),
        address_2=payload.address_2.strip() if payload.address_2 else None,
        city=payload.city.strip(),
        state=payload.state.strip(),
        country=payload.country.strip() if payload.country else "India",
        pin_code=payload.pin_code.strip(),
        is_primary=make_primary,
        shiprocket_pickup_id=sr_pickup_id
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh

@app.put("/api/admin/logistics/warehouses/{warehouse_id}/set-primary", response_model=schemas.WarehouseLocationResponse)
def admin_set_primary_warehouse(
    warehouse_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    wh = db.query(models.WarehouseLocation).filter_by(id=warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse location not found")

    db.query(models.WarehouseLocation).update({models.WarehouseLocation.is_primary: False})
    wh.is_primary = True
    db.commit()
    db.refresh(wh)
    return wh

@app.delete("/api/admin/logistics/warehouses/{warehouse_id}")
def admin_delete_warehouse(
    warehouse_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    wh = db.query(models.WarehouseLocation).filter_by(id=warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse location not found")

    total_wh = db.query(models.WarehouseLocation).count()
    if total_wh <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only configured warehouse location.")

    was_primary = wh.is_primary
    db.delete(wh)
    db.commit()

    if was_primary:
        new_primary = db.query(models.WarehouseLocation).first()
        if new_primary:
            new_primary.is_primary = True
            db.commit()

    return {"message": "Warehouse location removed successfully"}


# ============================================================
# ADMIN USERS MANAGEMENT
# ============================================================

@app.get("/api/admin/users")
def admin_list_users(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    role: Optional[str] = "customer",
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.User).options(selectinload(models.User.addresses))
    if role:
        q = q.filter(models.User.role == role)
    if search:
        search_filter = f"%{search}%"
        q = q.filter(
            (models.User.email.ilike(search_filter)) |
            (models.User.full_name.ilike(search_filter)) |
            (models.User.phone.ilike(search_filter))
        )
    total = q.count()
    users = q.order_by(models.User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for u in users:
        orders_count = db.query(func.count(models.Order.id)).filter(models.Order.user_id == u.id).scalar() or 0
        u_phone = u.phone
        if not u_phone and u.addresses:
            u_phone = u.addresses[0].phone
        items.append(schemas.AdminUserSchema(
            id=u.id,
            email=u.email,
            phone=u_phone,
            full_name=u.full_name,
            role=u.role,
            is_verified=u.is_verified,
            is_active=u.is_active,
            suspended_at=u.suspended_at.strftime("%b %d, %Y") if u.suspended_at else None,
            suspension_reason=u.suspension_reason,
            created_at=u.created_at.strftime("%b %d, %Y") if u.created_at else "",
            orders_count=orders_count
        ))
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": (total + page_size - 1) // page_size}

@app.get("/api/admin/users/{user_id}")
def admin_get_user(
    user_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).options(
        selectinload(models.User.orders).selectinload(models.Order.items),
        selectinload(models.User.addresses)
    ).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_orders = sorted(user.orders or [], key=lambda o: o.created_at, reverse=True)
    total_spend = sum(o.total_amount for o in user_orders if o.status != "CANCELLED")

    # Determine phone number
    user_phone = getattr(user, 'phone', None)
    if not user_phone and user.addresses:
        user_phone = user.addresses[0].phone

    orders_list = [
        {
            "id": o.id,
            "status": o.status,
            "total_amount": o.total_amount,
            "currency": o.currency,
            "created_at": o.created_at.strftime("%b %d, %Y %I:%M %p"),
            "items_count": len(o.items or []),
            "items_summary": ", ".join(i.product_title for i in (o.items or [])[:2]) + (f" + {len(o.items) - 2} more" if len(o.items or []) > 2 else "")
        }
        for o in user_orders
    ]

    addresses_list = [
        {
            "id": a.id,
            "label": a.label or "Home",
            "first_name": a.first_name,
            "last_name": a.last_name,
            "street_address": a.street_address,
            "apartment": a.apartment,
            "house_flat_no": a.house_flat_no,
            "building_name": a.building_name,
            "floor_no": a.floor_no,
            "block_wing": a.block_wing,
            "city": a.city,
            "state": a.state,
            "pincode": a.pincode,
            "phone": a.phone,
            "email": a.email,
            "is_default": a.is_default
        }
        for a in (user.addresses or [])
    ]

    return {
        "id": user.id,
        "email": user.email,
        "phone": user_phone,
        "full_name": user.full_name,
        "role": user.role,
        "is_verified": user.is_verified,
        "is_active": user.is_active,
        "suspended_at": user.suspended_at.strftime("%b %d, %Y") if user.suspended_at else None,
        "suspension_reason": user.suspension_reason,
        "created_at": user.created_at.strftime("%b %d, %Y"),
        "orders_count": len(user_orders),
        "total_spend": total_spend,
        "addresses": addresses_list,
        "orders": orders_list
    }


@app.put("/api/admin/users/{user_id}/suspend")
def admin_suspend_user(
    user_id: int,
    payload: schemas.UserSuspendRequest,
    background_tasks: BackgroundTasks,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot suspend your own account.")
    user = db.query(models.User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    user.suspended_at = datetime.utcnow()
    user.suspension_reason = payload.reason
    db.commit()

    if user.email:
        background_tasks.add_task(send_account_suspended_email, user.email, user.full_name or "", payload.reason or "")

    return {"message": f"User {user.email or user.id} suspended."}

@app.put("/api/admin/users/{user_id}/reactivate")
def admin_reactivate_user(
    user_id: int,
    background_tasks: BackgroundTasks,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    user.suspended_at = None
    user.suspension_reason = None
    db.commit()

    if user.email:
        background_tasks.add_task(send_account_reactivated_email, user.email, user.full_name or "")

    return {"message": f"User {user.email or user.id} reactivated."}

@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    background_tasks: BackgroundTasks,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account.")
    user = db.query(models.User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_email = user.email
    user_name = user.full_name or ""

    db.delete(user)
    db.commit()

    if user_email:
        background_tasks.add_task(send_account_deleted_email, user_email, user_name)

    return {"message": "User deleted permanently."}



# ============================================================
# ADMIN REVIEWS MANAGEMENT
# ============================================================

@app.get("/api/admin/reviews")
def admin_list_reviews(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    is_hidden: Optional[bool] = None,
    rating: Optional[int] = None,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.ProductReview).options(selectinload(models.ProductReview.product))
    if search:
        q = q.filter(
            (models.ProductReview.author.ilike(f"%{search}%")) | (models.ProductReview.content.ilike(f"%{search}%")) | (models.ProductReview.title.ilike(f"%{search}%"))
        )
    if is_hidden is not None:
        q = q.filter(models.ProductReview.is_hidden == is_hidden)
    if rating is not None:
        q = q.filter(models.ProductReview.rating == rating)
    total = q.count()
    reviews = q.order_by(models.ProductReview.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [
        schemas.AdminReviewSchema(
            id=r.id,
            product_id=r.product_id,
            product_title=r.product.title if r.product else "",
            rating=r.rating,
            title=r.title,
            author=r.author,
            date=r.date,
            content=r.content,
            verified=r.verified,
            is_approved=r.is_approved,
            is_hidden=r.is_hidden,
            created_at=r.created_at.strftime("%b %d, %Y") if r.created_at else None
        ) for r in reviews
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": (total + page_size - 1) // page_size}

@app.get("/api/admin/products/{product_id}/reviews")
def admin_list_product_reviews(
    product_id: int,
    page: int = 1,
    page_size: int = 20,
    rating: Optional[int] = None,
    is_hidden: Optional[bool] = None,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.ProductReview).filter_by(product_id=product_id)
    if is_hidden is not None:
        q = q.filter(models.ProductReview.is_hidden == is_hidden)
    if rating is not None:
        q = q.filter(models.ProductReview.rating == rating)
    total = q.count()

    reviews = q.order_by(models.ProductReview.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    product = db.query(models.Product).filter_by(id=product_id).first()
    product_title = product.title if product else ""
    items = [
        schemas.AdminReviewSchema(
            id=r.id, product_id=r.product_id, product_title=product_title,
            rating=r.rating, title=r.title, author=r.author, date=r.date,
            content=r.content, verified=r.verified, is_approved=r.is_approved,
            is_hidden=r.is_hidden, created_at=r.created_at.strftime("%b %d, %Y") if r.created_at else None
        ) for r in reviews
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": (total + page_size - 1) // page_size}

@app.post("/api/admin/products/{product_id}/reviews", response_model=schemas.AdminReviewSchema)
def admin_create_review(
    product_id: int,
    payload: schemas.AdminReviewCreateRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    product = db.query(models.Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    review = models.ProductReview(
        product_id=product_id,
        rating=payload.rating,
        title=payload.title,
        author=payload.author,
        date=datetime.now().strftime("%d/%m/%Y"),
        content=payload.content,
        verified=payload.verified,
        is_approved=payload.is_approved,
        is_hidden=False
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return schemas.AdminReviewSchema(
        id=review.id, product_id=review.product_id, product_title=product.title,
        rating=review.rating, title=review.title, author=review.author, date=review.date,
        content=review.content, verified=review.verified, is_approved=review.is_approved,
        is_hidden=review.is_hidden, created_at=review.created_at.strftime("%b %d, %Y") if review.created_at else None
    )

@app.put("/api/admin/reviews/{review_id}")
def admin_update_review(
    review_id: int,
    payload: schemas.ReviewAdminUpdateRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    review = db.query(models.ProductReview).filter_by(id=review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(review, k, v)
    db.commit()
    return {"message": "Review updated.", "id": review_id}

@app.delete("/api/admin/reviews/{review_id}")
def admin_delete_review(
    review_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    review = db.query(models.ProductReview).filter_by(id=review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    db.delete(review)
    db.commit()
    return {"message": "Review deleted."}


# ============================================================
# ADMIN MEDIA UPLOAD
# ============================================================

@app.post("/api/admin/media/presigned-url", response_model=schemas.PresignedUrlResponse)
def admin_get_presigned_url(
    payload: schemas.PresignedUrlRequest,
    admin: models.User = Depends(get_current_admin),
):
    res = storage.get_presigned_upload_url(
        filename=payload.filename,
        mime=payload.mime_type,
        folder=payload.folder or "products"
    )
    if "error" in res:
        raise HTTPException(status_code=500, detail=f"S3 Presigned URL generation failed: {res['error']}")
    return res


@app.post("/api/admin/media/upload")
async def admin_upload_media_direct(
    file: UploadFile = File(...),
    folder: str = Form("products"),
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    try:
        content = await file.read()
        mime = file.content_type or "application/octet-stream"
        safe_filename = file.filename or "media_asset"

        # Auto-compress raster images to high-res WebP
        if mime.startswith("image/") and "svg" not in mime and "gif" not in mime:
            try:
                import io
                from PIL import Image
                img = Image.open(io.BytesIO(content))
                max_dim = 2560
                w, h = img.size
                if w > max_dim or h > max_dim:
                    ratio = min(max_dim / w, max_dim / h)
                    img = img.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)
                out_buf = io.BytesIO()
                img.save(out_buf, "WEBP", quality=88, method=6)
                compressed_bytes = out_buf.getvalue()
                if len(compressed_bytes) < len(content):
                    content = compressed_bytes
                    mime = "image/webp"
                    base_name = os.path.splitext(safe_filename)[0]
                    safe_filename = f"{base_name}.webp"
            except Exception as opt_err:
                print(f"[MEDIA OPTIMIZATION FALLBACK] {opt_err}")

        key = storage.generate_key(safe_filename, folder=folder)
        public_url = storage.upload_file_bytes(content, key, mime)

        # Create MediaAsset record
        asset = models.MediaAsset(
            url=public_url,
            provider="s3",
            key=key,
            size=len(content),
            mime_type=mime,
            uploaded_by_id=admin.id
        )
        db.add(asset)
        db.commit()

        return {
            "url": public_url,
            "key": key,
            "name": safe_filename,
            "size": len(content)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Server S3 upload failed: {str(e)}")

@app.post("/api/admin/media/confirm")
def admin_confirm_media(
    payload: schemas.MediaAssetConfirmRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    asset = models.MediaAsset(
        url=payload.url,
        provider=payload.provider,
        key=payload.key,
        size=payload.size,
        mime_type=payload.mime_type,
        alt_text=payload.alt_text,
        uploaded_by_id=admin.id
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return schemas.MediaAssetSchema(
        id=asset.id,
        url=asset.url,
        provider=asset.provider,
        key=asset.key,
        size=asset.size,
        mime_type=asset.mime_type,
        alt_text=asset.alt_text,
        uploaded_by_id=asset.uploaded_by_id,
        created_at=asset.created_at.strftime("%Y-%m-%dT%H:%M:%S")
    )

@app.get("/api/admin/media")
def admin_list_media(
    page: int = 1,
    page_size: int = 24,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.MediaAsset).order_by(models.MediaAsset.created_at.desc())
    total = q.count()
    assets = q.offset((page - 1) * page_size).limit(page_size).all()
    items = [
        schemas.MediaAssetSchema(
            id=a.id, url=a.url, provider=a.provider, key=a.key,
            size=a.size, mime_type=a.mime_type, alt_text=a.alt_text,
            uploaded_by_id=a.uploaded_by_id,
            created_at=a.created_at.strftime("%Y-%m-%dT%H:%M:%S")
        ) for a in assets
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": (total + page_size - 1) // page_size}

@app.delete("/api/admin/media/{asset_id}")
def admin_delete_media(
    asset_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    asset = db.query(models.MediaAsset).filter_by(id=asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Delete file from AWS S3
    if asset.key:
        storage.delete_file(asset.key)
    elif asset.url:
        storage.delete_file(asset.url)

    db.delete(asset)
    db.commit()
    return {"message": "Asset and file deleted from storage."}


# ============================================================
# RESTOCK SUBSCRIPTIONS API
# ============================================================

def notify_restock_subscribers(db: Session, product_id: int, colour_value: Optional[str] = None, variant_id: Optional[str] = None, bg_tasks: Optional[BackgroundTasks] = None):
    try:
        q = db.query(models.RestockSubscription).filter_by(product_id=product_id, notified=False)
        if colour_value:
            q = q.filter(
                (func.lower(models.RestockSubscription.colour_value) == colour_value.lower()) |
                (models.RestockSubscription.colour_value == None) |
                (models.RestockSubscription.colour_value == "")
            )
        
        subscriptions = q.all()
        if not subscriptions:
            return

        product = db.query(models.Product).filter_by(id=product_id).first()
        if not product:
            return

        image_url = product.featured_image_url or (product.images[0].get("url") if product.images and isinstance(product.images, list) else "")

        for sub in subscriptions:
            if bg_tasks:
                bg_tasks.add_task(
                    send_restock_notification_email,
                    to_email=sub.email,
                    product_title=sub.product_title,
                    product_handle=sub.product_handle,
                    colour_value=sub.colour_value or colour_value or "",
                    image_url=image_url
                )
            else:
                send_restock_notification_email(
                    to_email=sub.email,
                    product_title=sub.product_title,
                    product_handle=sub.product_handle,
                    colour_value=sub.colour_value or colour_value or "",
                    image_url=image_url
                )
            sub.notified = True

        db.commit()
    except Exception as e:
        print(f"[RESTOCK TRIGGER ERROR]: {e}")


@app.post("/api/restock-subscriptions")
def create_restock_subscription(
    payload: schemas.RestockSubscriptionCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(models.RestockSubscription).filter_by(
        email=payload.email,
        product_id=payload.product_id,
        colour_value=payload.colour_value,
        notified=False
    ).first()

    if existing:
        return {"message": "You are already subscribed to restock notifications for this item.", "id": existing.id}

    sub = models.RestockSubscription(
        email=payload.email,
        product_id=payload.product_id,
        product_title=payload.product_title,
        product_handle=payload.product_handle,
        colour_value=payload.colour_value,
        variant_id=payload.variant_id
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"message": "Successfully subscribed to restock notifications.", "id": sub.id}


# ============================================================
# Size Guide Endpoints
# ============================================================

@app.get("/api/size-guide", response_model=List[schemas.SizeGuideTypeOut])
def public_get_size_guide(db: Session = Depends(get_db)):
    """Public: return all visible size guide types ordered by display_order."""
    types = (
        db.query(models.SizeGuideType)
        .filter_by(is_visible=True)
        .order_by(models.SizeGuideType.display_order)
        .all()
    )
    return types


@app.get("/api/admin/size-guide", response_model=List[schemas.SizeGuideTypeOut])
def admin_list_size_guide(
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: return ALL size guide types (including hidden)."""
    return (
        db.query(models.SizeGuideType)
        .order_by(models.SizeGuideType.display_order)
        .all()
    )


@app.post("/api/admin/size-guide", response_model=schemas.SizeGuideTypeOut, status_code=201)
def admin_create_size_guide_type(
    payload: schemas.SizeGuideTypeCreate,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: create a new size guide measurement type."""
    sg = models.SizeGuideType(
        name=payload.name,
        unit_label=payload.unit_label,
        is_visible=payload.is_visible,
        display_order=payload.display_order,
        diagram_image_url=payload.diagram_image_url,
        columns=payload.columns,
        rows=payload.rows,
        measuring_tips=[t.model_dump() for t in payload.measuring_tips],
    )
    db.add(sg)
    db.commit()
    db.refresh(sg)
    return sg


@app.put("/api/admin/size-guide/{sg_id}", response_model=schemas.SizeGuideTypeOut)
def admin_update_size_guide_type(
    sg_id: int,
    payload: schemas.SizeGuideTypeUpdate,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: update an existing size guide type (partial update)."""
    sg = db.query(models.SizeGuideType).filter_by(id=sg_id).first()
    if not sg:
        raise HTTPException(status_code=404, detail="Size guide type not found")

    data = payload.model_dump(exclude_unset=True)
    if "measuring_tips" in data and data["measuring_tips"] is not None:
        data["measuring_tips"] = [t if isinstance(t, dict) else t.model_dump() for t in payload.measuring_tips]
    for field, value in data.items():
        setattr(sg, field, value)
    sg.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(sg)
    return sg


@app.delete("/api/admin/size-guide/{sg_id}", status_code=204)
def admin_delete_size_guide_type(
    sg_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: delete a size guide type."""
    sg = db.query(models.SizeGuideType).filter_by(id=sg_id).first()
    if not sg:
        raise HTTPException(status_code=404, detail="Size guide type not found")

    # Delete diagram image from AWS S3
    if sg.diagram_image_url:
        storage.delete_file(sg.diagram_image_url)

    db.delete(sg)
    db.commit()


@app.put("/api/admin/size-guide-reorder", status_code=200)
def admin_reorder_size_guide(
    items: List[schemas.SizeGuideReorderItem],
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: bulk-update display_order for size guide types."""
    for item in items:
        sg = db.query(models.SizeGuideType).filter_by(id=item.id).first()
        if sg:
            sg.display_order = item.display_order
    db.commit()
    return {"message": "Reordered successfully"}


# ============================================================
# ADMIN DATABASE BACKUP TO AWS S3
# ============================================================

@app.post("/api/admin/database/backup")
def admin_trigger_database_backup(
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Generates an immediate SQL dump of the database and uploads it to AWS S3 under database-backups/."""
    try:
        import gzip
        import json
        from sqlalchemy import MetaData, select

        timestamp_str = datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"vahn_db_{timestamp_str}.sql.gz"
        s3_key = f"database-backups/{filename}"

        # Reflect and dump all tables
        meta = MetaData()
        meta.reflect(bind=engine)

        sql_lines = [
            "-- VAHN Automated Database Backup",
            f"-- Generated: {datetime.utcnow().isoformat()} UTC",
            "BEGIN;\n"
        ]

        for table in reversed(meta.sorted_tables):
            sql_lines.append(f"TRUNCATE TABLE \"{table.name}\" CASCADE;")
        sql_lines.append("\n")

        with engine.connect() as conn:
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
                            escaped = json.dumps(v).replace("'", "''")
                            vals.append(f"'{escaped}'::json")
                        elif isinstance(v, datetime):
                            vals.append(f"'{v.strftime('%Y-%m-%d %H:%M:%S.%f')}'")
                        else:
                            escaped = str(v).replace("'", "''")
                            vals.append(f"'{escaped}'")
                    vals_str = ", ".join(vals)
                    sql_lines.append(f"INSERT INTO \"{table.name}\" ({cols_str}) VALUES ({vals_str});")

        sql_lines.append("\nCOMMIT;\n")
        sql_bytes = "\n".join(sql_lines).encode("utf-8")
        compressed_bytes = gzip.compress(sql_bytes, compresslevel=9)

        # Upload directly to AWS S3
        s3_client = storage._get_client()
        s3_client.put_object(
            Bucket=storage.bucket,
            Key=s3_key,
            Body=compressed_bytes,
            ContentType="application/gzip",
            Metadata={
                "created_at": datetime.utcnow().isoformat(),
                "uncompressed_bytes": str(len(sql_bytes)),
            }
        )

        size_kb = round(len(compressed_bytes) / 1024, 2)
        public_url = storage.get_public_url(s3_key)

        return {
            "status": "success",
            "message": "Database backup created and uploaded to AWS S3 successfully.",
            "filename": filename,
            "s3_key": s3_key,
            "s3_url": public_url,
            "size_kb": size_kb,
            "created_at": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database backup failed: {str(e)}")


@app.get("/api/admin/database/backups")
def admin_list_database_backups(
    admin: models.User = Depends(get_current_admin)
):
    """Lists all database backups stored in AWS S3 under database-backups/."""
    try:
        s3_client = storage._get_client()
        res = s3_client.list_objects_v2(
            Bucket=storage.bucket,
            Prefix="database-backups/"
        )
        items = []
        for obj in res.get("Contents", []):
            key = obj["Key"]
            if key == "database-backups/":
                continue
            items.append({
                "key": key,
                "filename": key.split("/")[-1],
                "size_bytes": obj["Size"],
                "size_kb": round(obj["Size"] / 1024, 2),
                "last_modified": obj["LastModified"].isoformat(),
                "url": storage.get_public_url(key)
            })
        
        items.sort(key=lambda x: x["last_modified"], reverse=True)
        return {"backups": items, "total": len(items)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list backups: {str(e)}")


# ============================================================
# NOTIFICATION & ANNOUNCEMENT BANNERS (STOREFRONT & ADMIN)
# ============================================================

@app.get("/api/announcements/active", response_model=List[schemas.NotificationBannerOut])
def get_active_announcements(db: Session = Depends(get_db)):
    """Public storefront: returns all currently active notification/announcement banners."""
    now = datetime.utcnow()
    banners = (
        db.query(models.NotificationBanner)
        .filter(models.NotificationBanner.is_active == True)
        .filter(
            (models.NotificationBanner.start_date == None) | (models.NotificationBanner.start_date <= now)
        )
        .filter(
            (models.NotificationBanner.end_date == None) | (models.NotificationBanner.end_date >= now)
        )
        .order_by(models.NotificationBanner.display_order.asc(), models.NotificationBanner.created_at.desc())
        .all()
    )
    return banners


@app.get("/api/admin/announcements", response_model=List[schemas.NotificationBannerOut])
def admin_list_announcements(
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: list all announcement banners."""
    return (
        db.query(models.NotificationBanner)
        .order_by(models.NotificationBanner.display_order.asc(), models.NotificationBanner.created_at.desc())
        .all()
    )


@app.post("/api/admin/announcements", response_model=schemas.NotificationBannerOut, status_code=201)
def admin_create_announcement(
    payload: schemas.NotificationBannerCreate,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: create a new notification/announcement banner."""
    banner = models.NotificationBanner(
        title=payload.title,
        message=payload.message,
        link_url=payload.link_url,
        link_text=payload.link_text,
        banner_type=payload.banner_type,
        bg_color=payload.bg_color,
        text_color=payload.text_color,
        is_active=payload.is_active,
        is_closable=payload.is_closable,
        display_order=payload.display_order,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(banner)
    db.commit()
    db.refresh(banner)
    return banner


@app.get("/api/admin/announcements/{banner_id}", response_model=schemas.NotificationBannerOut)
def admin_get_announcement(
    banner_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: get single banner details."""
    banner = db.query(models.NotificationBanner).filter_by(id=banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Announcement banner not found")
    return banner


@app.put("/api/admin/announcements/{banner_id}", response_model=schemas.NotificationBannerOut)
def admin_update_announcement(
    banner_id: int,
    payload: schemas.NotificationBannerUpdate,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: update an announcement banner."""
    banner = db.query(models.NotificationBanner).filter_by(id=banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Announcement banner not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(banner, field, value)
    banner.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(banner)
    return banner


@app.patch("/api/admin/announcements/{banner_id}/toggle", response_model=schemas.NotificationBannerOut)
def admin_toggle_announcement(
    banner_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: 1-click active/inactive toggle."""
    banner = db.query(models.NotificationBanner).filter_by(id=banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Announcement banner not found")

    banner.is_active = not banner.is_active
    banner.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(banner)
    return banner


@app.delete("/api/admin/announcements/{banner_id}", status_code=204)
def admin_delete_announcement(
    banner_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: delete an announcement banner."""
    banner = db.query(models.NotificationBanner).filter_by(id=banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Announcement banner not found")

    db.delete(banner)
    db.commit()


@app.put("/api/admin/announcements-reorder", status_code=200)
def admin_reorder_announcements(
    items: List[schemas.NotificationBannerReorderItem],
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: bulk reorder announcement banners."""
    for item in items:
        b = db.query(models.NotificationBanner).filter_by(id=item.id).first()
        if b:
            b.display_order = item.display_order
    db.commit()
    return {"message": "Reordered successfully"}


# ============================================================
# Contact Messages & Customer Care Endpoints
# ============================================================

@app.post("/api/contact")
def submit_contact_inquiry(
    data: schemas.ContactMessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Public customer contact form submission.
    Stores inquiry in database and dispatches notifications via Amazon SES asynchronously.
    """
    contact_msg = models.ContactMessage(
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        country_code=data.country_code or "+91",
        phone=data.phone,
        order_number=data.order_number,
        subject=data.subject,
        message=data.message,
        status="NEW"
    )
    db.add(contact_msg)
    db.commit()
    db.refresh(contact_msg)

    # Prepare payload for background email dispatch
    inquiry_payload = {
        "id": contact_msg.id,
        "first_name": contact_msg.first_name,
        "last_name": contact_msg.last_name,
        "email": contact_msg.email,
        "country_code": contact_msg.country_code,
        "phone": contact_msg.phone,
        "order_number": contact_msg.order_number,
        "subject": contact_msg.subject,
        "message": contact_msg.message,
    }

    # Dispatch email notification to support@vahnsports.com
    background_tasks.add_task(send_contact_inquiry_notification, inquiry_payload)

    # Dispatch receipt to customer
    background_tasks.add_task(
        send_contact_inquiry_receipt,
        to_email=contact_msg.email,
        customer_name=f"{contact_msg.first_name} {contact_msg.last_name}".strip(),
        subject_topic=contact_msg.subject
    )

    return {
        "success": True,
        "message": "Your message has been received. Our support team will get back to you shortly.",
        "id": contact_msg.id
    }


@app.get("/api/admin/contact-messages", response_model=schemas.ContactMessageListResponse)
def list_admin_contact_messages(
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Admin: Fetch contact inquiries with status filtering, search, and counts.
    """
    query = db.query(models.ContactMessage)

    if status and status.upper() != "ALL":
        query = query.filter(models.ContactMessage.status == status.upper())

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            sqlalchemy.or_(
                models.ContactMessage.first_name.ilike(search_pattern),
                models.ContactMessage.last_name.ilike(search_pattern),
                models.ContactMessage.email.ilike(search_pattern),
                models.ContactMessage.order_number.ilike(search_pattern),
                models.ContactMessage.subject.ilike(search_pattern),
                models.ContactMessage.message.ilike(search_pattern),
            )
        )

    total = query.count()
    offset = (max(1, page) - 1) * limit
    items = query.order_by(models.ContactMessage.created_at.desc()).offset(offset).limit(limit).all()

    # Calculate status counts for UI badge filters
    all_count = db.query(models.ContactMessage).count()
    new_count = db.query(models.ContactMessage).filter(models.ContactMessage.status == "NEW").count()
    in_progress_count = db.query(models.ContactMessage).filter(models.ContactMessage.status == "IN_PROGRESS").count()
    resolved_count = db.query(models.ContactMessage).filter(models.ContactMessage.status == "RESOLVED").count()
    archived_count = db.query(models.ContactMessage).filter(models.ContactMessage.status == "ARCHIVED").count()

    total_pages = (total + limit - 1) // limit if total > 0 else 1

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "counts": {
            "all": all_count,
            "new": new_count,
            "in_progress": in_progress_count,
            "resolved": resolved_count,
            "archived": archived_count,
        }
    }


@app.get("/api/admin/contact-messages/{message_id}", response_model=schemas.ContactMessageOut)
def get_admin_contact_message(
    message_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: Get single contact inquiry."""
    msg = db.query(models.ContactMessage).filter_by(id=message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return msg


@app.patch("/api/admin/contact-messages/{message_id}", response_model=schemas.ContactMessageOut)
def update_admin_contact_message(
    message_id: int,
    data: schemas.ContactMessageUpdate,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: Update contact inquiry status and internal notes."""
    msg = db.query(models.ContactMessage).filter_by(id=message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    if data.status is not None:
        msg.status = data.status.upper()
    if data.admin_notes is not None:
        msg.admin_notes = data.admin_notes
    msg.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(msg)
    return msg


@app.delete("/api/admin/contact-messages/{message_id}", status_code=204)
def delete_admin_contact_message(
    message_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Admin: Delete contact inquiry."""
    msg = db.query(models.ContactMessage).filter_by(id=message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    db.delete(msg)
    db.commit()



