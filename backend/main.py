import secrets
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func

from database import Base, engine, get_db
import models
import schemas
from email_service import (
    send_order_confirmation_email, send_restock_notification_email,
    send_account_suspended_email, send_account_reactivated_email, send_account_deleted_email
)

from sms_service import send_otp_sms
from auth_utils import (
    generate_salt, hash_password, verify_password,
    create_access_token, get_current_user, get_current_admin,
    create_otp_token, verify_otp_token, check_rate_limit, normalize_phone
)
from storage import storage

import asyncio
from contextlib import asynccontextmanager
import sqlalchemy
import os

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
        elif path.startswith("/api/products/"):
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
        elif path.startswith("/api/products") or path.startswith("/api/collections"):
            response.headers["Cache-Control"] = "public, max-age=5, s-maxage=10, stale-while-revalidate=30"
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
                    selectedOptions=[schemas.SelectedOption(**opt) for opt in v.selected_options],
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

    colour_group_schemas = [
        schemas.StorefrontColourGroupSchema(
            id=cg.id,
            colourValue=cg.colour_value,
            displayOrder=cg.display_order,
            images=[
                schemas.StorefrontColourGroupImageSchema(
                    url=img.get("url", "") if isinstance(img, dict) else getattr(img, "url", ""),
                    altText=(img.get("altText", "") if isinstance(img, dict) else getattr(img, "alt_text", "")) or ""
                )
                for img in (cg.images or [])
            ]
        )
        for cg in (prod.colour_groups or [])
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
    return {"status": "ok", "service": "VAHN Backend API", "timestamp": datetime.utcnow().isoformat()}

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
                        selectedOptions=[schemas.SelectedOption(**opt) for opt in v.selected_options],
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

@app.post("/api/auth/check-phone")
def check_phone(payload: schemas.PhoneLookupRequest, db: Session = Depends(get_db)):
    """
    Probe whether a phone number is already registered.
    Returns {exists: bool} — no OTP sent, no side effects.
    """
    phone = normalize_phone(payload.phone)
    user = db.query(models.User).filter(
        models.User.phone == phone,
        models.User.role == "customer"
    ).first()
    return {"exists": user is not None}

@app.post("/api/auth/send-otp")
def send_otp(payload: schemas.SendOTPRequest, db: Session = Depends(get_db)):
    """
    Unified register + login: send OTP to phone.
    - Existing user: OTP sent immediately.
    - New user: full_name + email required; user record created (unverified) then OTP sent.
    Rate limited: max 3 per 10 min per phone.
    """
    phone = normalize_phone(payload.phone)
    check_rate_limit(phone)  # Raises 429 if too many requests

    user = db.query(models.User).filter(
        models.User.phone == phone,
        models.User.role == "customer"
    ).first()

    if user:
        # Existing user — login flow
        if not user.is_active:
            reason_msg = f" Reason: {user.suspension_reason}." if user.suspension_reason else ""
            raise HTTPException(status_code=403, detail=f"Your account has been suspended by administration.{reason_msg} Please contact support for assistance.")
        otp = generate_6digit_otp()
        otp_token = create_otp_token(phone, otp)
        send_otp_sms(phone, otp)
        return {"otp_token": otp_token, "is_new_user": False}

    else:
        # New user — register flow: validate required fields
        if not payload.full_name or not payload.full_name.strip():
            raise HTTPException(
                status_code=422,
                detail="Full name is required to create your account."
            )
        if not payload.email:
            raise HTTPException(
                status_code=422,
                detail="Email address is required to create your account."
            )
        # Check if email already taken
        email = payload.email.strip().lower()
        existing_email = db.query(models.User).filter_by(email=email).first()
        if existing_email:
            raise HTTPException(
                status_code=400,
                detail="This email address is already registered. Try a different email."
            )

        # Create user record (is_verified=False until OTP confirmed)
        new_user = models.User(
            phone=phone,
            email=email,
            full_name=payload.full_name.strip(),
            role="customer",
            is_verified=False,
            phone_verified=False,
        )
        db.add(new_user)
        db.commit()

        otp = generate_6digit_otp()
        otp_token = create_otp_token(phone, otp)
        send_otp_sms(phone, otp)
        return {"otp_token": otp_token, "is_new_user": True}

@app.post("/api/auth/verify-otp", response_model=schemas.AuthResponse)
def verify_otp(payload: schemas.VerifyOTPRequest, db: Session = Depends(get_db)):
    """
    Verify OTP for customer login/registration.
    - Validates HMAC-signed token (5-min expiry, max 5 attempts).
    - On success: marks user verified, returns JWT access token.
    """
    phone = normalize_phone(payload.phone)

    # HMAC token verification (raises HTTPException on failure)
    verify_otp_token(phone, payload.otp_code, payload.otp_token)

    user = db.query(models.User).filter(
        models.User.phone == phone,
        models.User.role == "customer"
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found. Please start over.")
    if not user.is_active:
        reason_msg = f" Reason: {user.suspension_reason}." if user.suspension_reason else ""
        raise HTTPException(status_code=403, detail=f"Your account has been suspended by administration.{reason_msg} Please contact support for assistance.")


    user.is_verified = True
    user.phone_verified = True
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email or "", role="customer")
    return schemas.AuthResponse(access_token=token, token_type="bearer", user=_user_schema(user))

@app.get("/api/auth/me", response_model=schemas.UserSchema)
def get_me(current_user: models.User = Depends(get_current_user)):
    return _user_schema(current_user)

@app.put("/api/auth/profile", response_model=schemas.UserSchema)
def update_profile(payload: schemas.ProfileUpdateRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.full_name = payload.full_name.strip()
    db.commit()
    db.refresh(current_user)
    return _user_schema(current_user)

# ============================================================
# Order & Checkout Routes (Strict Pydantic Validation)
# ============================================================

def build_order_schema(order: models.Order) -> schemas.OrderSchema:
    item_schemas = []
    for item in order.items:
        item_schemas.append(
            schemas.OrderItemSchema(
                id=item.id,
                variantId=item.variant_id,
                productTitle=item.product_title,
                variantTitle=item.variant_title,
                imageUrl=item.image_url,
                price=schemas.Money(amount=f"{item.price_amount:.2f}", currencyCode=order.currency),
                quantity=item.quantity
            )
        )

    addr_dict = order.shipping_address or {}
    shipping_addr = schemas.ShippingAddress(
        name=addr_dict.get("name", "Customer"),
        address=addr_dict.get("address", "Standard Delivery"),
        city=addr_dict.get("city", "City"),
        postalCode=addr_dict.get("postalCode", "000000"),
        phone=addr_dict.get("phone", "")
    )

def build_order_schema(order: models.Order) -> schemas.OrderSchema:
    item_schemas = [
        schemas.OrderItemSchema(
            id=i.id,
            variantId=i.variant_id,
            productTitle=i.product_title,
            variantTitle=i.variant_title,
            imageUrl=i.image_url,
            price=schemas.Money(amount=f"{i.price_amount:.2f}", currencyCode=order.currency),
            quantity=i.quantity
        ) for i in order.items
    ]

    return schemas.OrderSchema(
        id=order.id,
        status=order.status,
        refundStatus=order.refund_status,
        subtotalPrice=schemas.Money(amount=f"{order.subtotal_amount:.2f}", currencyCode=order.currency),
        taxPrice=schemas.Money(amount=f"{getattr(order, 'tax_amount', 0.0) or 0.0:.2f}", currencyCode=order.currency),
        shippingPrice=schemas.Money(amount=f"{getattr(order, 'shipping_amount', 0.0) or 0.0:.2f}", currencyCode=order.currency),
        discountPrice=schemas.Money(amount=f"{getattr(order, 'discount_amount', 0.0) or 0.0:.2f}", currencyCode=order.currency),
        totalPrice=schemas.Money(amount=f"{order.total_amount:.2f}", currencyCode=order.currency),
        shippingAddress=order.shipping_address,
        createdAt=order.created_at.strftime("%b %d, %Y"),
        items=item_schemas
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
# CHECKOUT & ORDERS
# ============================================================

@app.post("/api/orders/checkout", response_model=schemas.OrderSchema)
def checkout(payload: schemas.CheckoutRequest, background_tasks: BackgroundTasks, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    cart = db.query(models.Cart).options(
        selectinload(models.Cart.items).selectinload(models.CartItem.variant).selectinload(models.ProductVariant.product)
    ).filter_by(id=payload.cart_id).first()

    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty or not found.")

    # Determine shipping address
    final_address_dict = {}

    if payload.address_id:
        user_addr = db.query(models.UserAddress).filter_by(id=payload.address_id, user_id=current_user.id).first()
        if not user_addr:
            raise HTTPException(status_code=404, detail="Selected address not found.")
        final_address_dict = {
            "label": user_addr.label,
            "name": f"{user_addr.first_name} {user_addr.last_name}",
            "address": f"{user_addr.street_address}{f', {user_addr.apartment}' if user_addr.apartment else ''}",
            "city": user_addr.city,
            "state": user_addr.state,
            "postalCode": user_addr.pincode,
            "country": "India",
            "phone": user_addr.phone
        }
    elif payload.shipping_address:
        raw_addr = payload.shipping_address
        country = str(raw_addr.get("country", "India")).strip().lower()
        if country not in ["india", "in"]:
            raise HTTPException(status_code=400, detail="Shipping is currently only available within India.")
        pincode = str(raw_addr.get("postalCode", raw_addr.get("pincode", ""))).strip()
        import re
        if not re.match(r'^[1-9][0-9]{5}$', pincode):
            raise HTTPException(status_code=400, detail="Please enter a valid 6-digit Indian PIN Code (e.g. 400001).")

        final_address_dict = {
            "label": raw_addr.get("label", "Home"),
            "name": raw_addr.get("name", current_user.full_name),
            "address": raw_addr.get("address", raw_addr.get("street_address", "Standard Address")),
            "city": raw_addr.get("city", "Mumbai"),
            "state": raw_addr.get("state", "Maharashtra"),
            "postalCode": pincode,
            "country": "India",
            "phone": raw_addr.get("phone", "")
        }
    else:
        # Fallback to user default address or first address
        default_addr = db.query(models.UserAddress).filter_by(user_id=current_user.id, is_default=True).first()
        if not default_addr:
            default_addr = db.query(models.UserAddress).filter_by(user_id=current_user.id).first()

        if default_addr:
            final_address_dict = {
                "label": default_addr.label,
                "name": f"{default_addr.first_name} {default_addr.last_name}",
                "address": f"{default_addr.street_address}{f', {default_addr.apartment}' if default_addr.apartment else ''}",
                "city": default_addr.city,
                "state": default_addr.state,
                "postalCode": default_addr.pincode,
                "country": "India",
                "phone": default_addr.phone
            }
        else:
            final_address_dict = {
                "label": "Home",
                "name": current_user.full_name,
                "address": "Standard Express Shipping",
                "city": "Mumbai",
                "state": "Maharashtra",
                "postalCode": "400001",
                "country": "India",
                "phone": "+91 9876543210"
            }

    order_id = f"ORD-{secrets.randbelow(899999) + 100000}"
    subtotal = 0.0
    tax_amount = 0.0
    custom_shipping_rates = []
    items_summary = []

    # Calculate shipping & tax per product
    for item in cart.items:
        var = item.variant
        prod = var.product if var else None
        if var:
            if var.inventory_quantity < item.quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {var.title}. Only {var.inventory_quantity} remaining.")
            var.inventory_quantity = max(0, var.inventory_quantity - item.quantity)

        item_price = var.price_amount if var else 0.0
        line_total = item_price * item.quantity
        subtotal += line_total

        items_summary.append({
            "title": prod.title if prod else "Product",
            "variant": var.title if var else "Default",
            "quantity": item.quantity,
            "price": item_price
        })

        # Calculate GST for single or multiple pieces of this product automatically
        gst_pct = prod.gst_percent if (prod and prod.gst_percent is not None) else 12.0
        item_tax = line_total * (gst_pct / (100.0 + gst_pct))
        tax_amount += item_tax

        # Track per-product shipping rate overrides
        if prod and prod.shipping_rate is not None:
            custom_shipping_rates.append(prod.shipping_rate)

    # Calculate shipping fee: use max product custom shipping rate if set, else global rule
    if custom_shipping_rates:
        shipping_amount = max(custom_shipping_rates)
    else:
        shipping_amount = 0.0 if subtotal >= 1999.0 else 99.0

    tax_amount = round(tax_amount, 2)
    total_amount = subtotal + shipping_amount

    order = models.Order(
        id=order_id,
        user_id=current_user.id,
        status="PROCESSING",
        subtotal_amount=subtotal,
        shipping_amount=shipping_amount,
        tax_amount=tax_amount,
        discount_amount=0.0,
        total_amount=total_amount,
        currency="INR",
        shipping_address=final_address_dict
    )
    db.add(order)
    db.flush()

    for item in cart.items:
        var = item.variant
        prod = var.product if var else None
        item_price = var.price_amount if var else 0.0

        order_item = models.OrderItem(
            id=str(uuid.uuid4()),
            order_id=order.id,
            variant_id=item.variant_id,
            product_title=prod.title if prod else "Product",
            variant_title=var.title if var else "Default",
            image_url=var.image_url if (var and var.image_url) else (prod.featured_image_url if prod else None),
            price_amount=item_price,
            quantity=item.quantity
        )
        db.add(order_item)

    # Empty cart after checkout
    for item in cart.items:
        db.delete(item)

    db.commit()
    db.refresh(order)

    # Send Order Confirmation Email asynchronously in background task
    background_tasks.add_task(
        send_order_confirmation_email,
        to_email=current_user.email,
        order_id=order.id,
        total_amount=order.total_amount,
        currency=order.currency,
        items_summary=items_summary
    )

    return build_order_schema(order)

@app.get("/api/orders", response_model=List[schemas.OrderSchema])
def get_user_orders(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(user_id=current_user.id).order_by(models.Order.created_at.desc()).all()
    return [build_order_schema(o) for o in orders]

@app.get("/api/orders/{order_id}", response_model=schemas.OrderSchema)
def get_order_detail(order_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(id=order_id, user_id=current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    return build_order_schema(order)


# ============================================================
# ADMIN AUTH ROUTES (Phone-OTP Flow — No UI registration, admin accounts seeded directly)
# ============================================================

@app.post("/api/admin/auth/check-phone")
def admin_check_phone(payload: schemas.AdminSendOTPRequest, db: Session = Depends(get_db)):
    """
    Check if a phone number is registered as an admin.
    Returns {exists: bool, is_admin: bool}.
    """
    phone = normalize_phone(payload.phone)
    user = db.query(models.User).filter(
        models.User.phone == phone,
        models.User.role == "admin"
    ).first()
    return {"exists": user is not None, "is_admin": user is not None}

@app.post("/api/admin/auth/send-otp")
def admin_send_otp(payload: schemas.AdminSendOTPRequest, db: Session = Depends(get_db)):
    """
    Send login OTP to an admin phone number.
    Admin accounts are NOT self-registerable — they must be seeded.
    Rate limited: max 3 per 10 min per phone.
    """
    phone = normalize_phone(payload.phone)
    check_rate_limit(phone)

    user = db.query(models.User).filter(
        models.User.phone == phone,
        models.User.role == "admin"
    ).first()
    if not user:
        raise HTTPException(
            status_code=403,
            detail="This phone number is not authorized for admin access. Contact the system administrator."
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Admin account is suspended.")

    otp = generate_6digit_otp()
    otp_token = create_otp_token(phone, otp)
    send_otp_sms(phone, otp)
    return {"otp_token": otp_token}

@app.post("/api/admin/auth/verify-otp", response_model=schemas.AuthResponse)
def admin_verify_otp(payload: schemas.AdminVerifyOTPRequest, db: Session = Depends(get_db)):
    """
    Verify admin OTP. HMAC-signed token — OTP never stored in DB.
    On success: returns JWT token with role=admin.
    """
    phone = normalize_phone(payload.phone)
    verify_otp_token(phone, payload.otp_code, payload.otp_token)

    user = db.query(models.User).filter(
        models.User.phone == phone,
        models.User.role == "admin"
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin account not found.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Admin account is suspended.")

    user.is_verified = True
    user.phone_verified = True
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email or "", role="admin")
    return schemas.AuthResponse(
        access_token=token,
        token_type="bearer",
        user=schemas.UserSchema(
            id=user.id,
            phone=user.phone,
            email=user.email,
            full_name=user.full_name,
            is_verified=user.is_verified
        )
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
        db.delete(product)
        db.commit()
        return {"message": "Product permanently deleted."}
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
    return [schemas.ColourGroupSchema(id=g.id, product_id=g.product_id, colour_value=g.colour_value, images=g.images or [], display_order=g.display_order) for g in groups]

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
        display_order=payload.display_order
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return schemas.ColourGroupSchema(id=group.id, product_id=group.product_id, colour_value=group.colour_value, images=group.images or [], display_order=group.display_order)

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
    return schemas.ColourGroupSchema(id=group.id, product_id=group.product_id, colour_value=group.colour_value, images=group.images or [], display_order=group.display_order)

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
    db.delete(group)
    db.commit()
    return {"message": "Colour group deleted."}


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
    if search:
        q = q.join(models.User).filter(
            (models.User.email.ilike(f"%{search}%")) | (models.Order.id.ilike(f"%{search}%"))
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
            created_at=o.created_at.strftime("%b %d, %Y"),
            user_email=o.user.email if o.user else "",
            user_name=o.user.full_name if o.user else "",
            items_count=len(o.items)
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

def _admin_order_detail(order: models.Order) -> schemas.AdminOrderSchema:
    return schemas.AdminOrderSchema(
        id=order.id,
        status=order.status,
        refund_status=order.refund_status,
        refund_note=order.refund_note,
        subtotal_amount=order.subtotal_amount,
        total_amount=order.total_amount,
        currency=order.currency,
        shipping_address=order.shipping_address,
        created_at=order.created_at.strftime("%Y-%m-%dT%H:%M:%S") if order.created_at else "",
        updated_at=order.updated_at.strftime("%Y-%m-%dT%H:%M:%S") if order.updated_at else None,
        user_id=order.user.id if order.user else 0,
        user_email=order.user.email if order.user else "",
        user_name=order.user.full_name if order.user else "",
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
    q = db.query(models.User)
    if role:
        q = q.filter(models.User.role == role)
    if search:
        q = q.filter(
            (models.User.email.ilike(f"%{search}%")) | (models.User.full_name.ilike(f"%{search}%"))
        )
    total = q.count()
    users = q.order_by(models.User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for u in users:
        orders_count = db.query(func.count(models.Order.id)).filter(models.Order.user_id == u.id).scalar() or 0
        items.append(schemas.AdminUserSchema(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            is_verified=u.is_verified,
            is_active=u.is_active,
            suspended_at=u.suspended_at.strftime("%b %d, %Y") if u.suspended_at else None,
            suspension_reason=u.suspension_reason,
            created_at=u.created_at.strftime("%b %d, %Y"),
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
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.ProductReview).filter_by(product_id=product_id)
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
    db.delete(asset)
    db.commit()
    return {"message": "Asset record deleted."}


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
