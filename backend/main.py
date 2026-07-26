import secrets
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func

from database import Base, engine, get_db
import models
import schemas
from email_service import send_otp_email, send_order_confirmation_email
from auth_utils import generate_salt, hash_password, verify_password, create_access_token, get_current_user, get_current_admin
from storage import storage

import os

root_path = "/api/backend" if os.getenv("VERCEL") else ""
app = FastAPI(title="VAHN Standalone Backend API", root_path=root_path, redirect_slashes=False)

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
        if path.startswith("/api/products") or path.startswith("/api/collections"):
            response.headers["Cache-Control"] = "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
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
        reviews=review_schemas,
        fit=prod.fit,
        kitType=prod.kit_type,
        activity=prod.activity,
        gstPercent=prod.gst_percent if prod.gst_percent is not None else 12.0,
        shippingRate=prod.shipping_rate
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
    db.refresh(cart)
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
    db.refresh(cart)
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

# ============================================================
# User Authentication & Profile Routes (Strict Pydantic Validation)
# ============================================================

def generate_6digit_otp() -> str:
    return "".join([str(secrets.randbelow(10)) for _ in range(6)])

@app.post("/api/auth/register")
def register(payload: schemas.UserRegisterRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    existing_user = db.query(models.User).filter_by(email=email).first()
    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(status_code=400, detail="Account with this email already exists. Please log in.")
        # Re-send OTP for unverified user
        otp = generate_6digit_otp()
        existing_user.otp_code = otp
        existing_user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
        existing_user.full_name = payload.full_name
        salt = generate_salt()
        existing_user.salt = salt
        existing_user.password_hash = hash_password(payload.password, salt)
        db.commit()
        background_tasks.add_task(send_otp_email, email, otp, subject="Your VAHN Sign-Up Verification Code")
        return {"message": "Verification code sent to your email.", "email": email}

    salt = generate_salt()
    pwd_hash = hash_password(payload.password, salt)
    otp = generate_6digit_otp()

    user = models.User(
        email=email,
        password_hash=pwd_hash,
        salt=salt,
        full_name=payload.full_name,
        is_verified=False,
        otp_code=otp,
        otp_expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.add(user)
    db.commit()

    background_tasks.add_task(send_otp_email, email, otp, subject="Your VAHN Sign-Up Verification Code")
    return {"message": "Verification code sent to your email.", "email": email}

@app.post("/api/auth/verify-otp", response_model=schemas.AuthResponse)
def verify_otp(payload: schemas.OTPVerifyRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(models.User).filter_by(email=email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if not user.otp_code or user.otp_code != payload.otp_code:
        raise HTTPException(status_code=400, detail="Invalid verification code. Please check and try again.")

    if user.otp_expires_at and datetime.utcnow() > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new code.")

    user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email, role=user.role)
    user_schema = schemas.UserSchema(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_verified=user.is_verified
    )
    return schemas.AuthResponse(access_token=token, token_type="bearer", user=user_schema)

@app.post("/api/auth/login")
def login(payload: schemas.UserLoginRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(models.User).filter_by(email=email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email. Please register below.")
    if not verify_password(payload.password, user.password_hash, user.salt):
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")

    otp = generate_6digit_otp()
    user.otp_code = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    background_tasks.add_task(send_otp_email, email, otp, subject="Your VAHN Login Verification Code")
    return {"message": "Verification code sent to your email.", "email": email}

@app.post("/api/auth/login-verify-otp", response_model=schemas.AuthResponse)
def login_verify_otp(payload: schemas.OTPVerifyRequest, db: Session = Depends(get_db)):
    return verify_otp(payload, db)

@app.get("/api/auth/me", response_model=schemas.UserSchema)
def get_me(current_user: models.User = Depends(get_current_user)):
    return schemas.UserSchema(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_verified=current_user.is_verified
    )

@app.put("/api/auth/profile", response_model=schemas.UserSchema)
def update_profile(payload: schemas.ProfileUpdateRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.full_name = payload.full_name.strip()
    db.commit()
    db.refresh(current_user)
    return schemas.UserSchema(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_verified=current_user.is_verified
    )

@app.put("/api/auth/change-password")
def change_password(payload: schemas.PasswordChangeRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, current_user.password_hash, current_user.salt):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    new_salt = generate_salt()
    new_hash = hash_password(payload.new_password, new_salt)
    current_user.salt = new_salt
    current_user.password_hash = new_hash
    db.commit()
    return {"message": "Password changed successfully."}

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
            city=a.city,
            state=a.state,
            pincode=a.pincode,
            country=a.country or "India",
            phone=a.phone,
            latitude=a.latitude,
            longitude=a.longitude,
            is_default=a.is_default,
            created_at=a.created_at.strftime("%b %d, %Y")
        ) for a in addresses
    ]

@app.post("/api/user/addresses", response_model=schemas.UserAddressSchema)
def create_user_address(payload: schemas.UserAddressCreateRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Strict India Check
    if payload.country.strip().lower() not in ["india", "in"]:
        raise HTTPException(status_code=400, detail="Shipping is currently only available within India.")

    import re
    if not re.match(r'^[1-9][0-9]{5}$', payload.pincode.strip()):
        raise HTTPException(status_code=400, detail="Please enter a valid 6-digit Indian PIN Code (e.g. 400001).")

    # If first address or set as default, update others
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
        city=payload.city.strip(),
        state=payload.state.strip(),
        pincode=payload.pincode.strip(),
        country="India",
        phone=payload.phone.strip(),
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
        city=addr.city,
        state=addr.state,
        pincode=addr.pincode,
        country=addr.country,
        phone=addr.phone,
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
# ADMIN AUTH ROUTES
# ============================================================

ADMIN_REGISTRATION_SECRET = os.getenv("ADMIN_REGISTRATION_SECRET", "vahn-admin-secret-2026")

@app.post("/api/admin/auth/register")
def admin_register(payload: schemas.AdminRegisterRequest, db: Session = Depends(get_db)):
    if payload.admin_secret != ADMIN_REGISTRATION_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin registration secret.")

    email = payload.email.strip().lower()
    existing = db.query(models.User).filter_by(email=email).first()
    if existing:
        if existing.is_verified:
            raise HTTPException(
                status_code=400,
                detail="An account with this email is already registered. Please sign in instead."
            )
        if existing.role != "admin":
            raise HTTPException(
                status_code=400,
                detail="This email is registered as a customer account."
            )
        otp = generate_6digit_otp()
        existing.otp_code = otp
        existing.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
        salt = generate_salt()
        existing.salt = salt
        existing.password_hash = hash_password(payload.password, salt)
        existing.full_name = payload.full_name
        db.commit()
        send_otp_email(email, otp, subject="VAHN Admin Registration — Verification Code")
        return {"message": "OTP sent to your email.", "email": email}

    salt = generate_salt()
    otp = generate_6digit_otp()
    user = models.User(
        email=email,
        password_hash=hash_password(payload.password, salt),
        salt=salt,
        full_name=payload.full_name,
        role="admin",
        is_verified=False,
        otp_code=otp,
        otp_expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.add(user)
    db.commit()
    send_otp_email(email, otp, subject="VAHN Admin Registration — Verification Code")
    return {"message": "OTP sent to your email.", "email": email}

@app.post("/api/admin/auth/verify-otp", response_model=schemas.AuthResponse)
def admin_verify_otp(payload: schemas.OTPVerifyRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(models.User).filter_by(email=email).first()
    if not user or user.role != "admin":
        raise HTTPException(status_code=404, detail="Admin account not found.")
    if not user.otp_code or user.otp_code != payload.otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP code.")
    if user.otp_expires_at and datetime.utcnow() > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email, role="admin")
    return schemas.AuthResponse(
        access_token=token,
        token_type="bearer",
        user=schemas.UserSchema(id=user.id, email=user.email, full_name=user.full_name, is_verified=user.is_verified)
    )

@app.post("/api/admin/auth/login")
def admin_login(payload: schemas.AdminLoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(models.User).filter_by(email=email).first()
    if not user or user.role != "admin":
        raise HTTPException(status_code=404, detail="No admin account found with this email.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Admin account is suspended.")
    if not verify_password(payload.password, user.password_hash, user.salt):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    otp = generate_6digit_otp()
    user.otp_code = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    db.commit()
    send_otp_email(email, otp, subject="VAHN Admin Login — Verification Code")
    return {"message": "OTP sent to your email.", "email": email}

@app.post("/api/admin/auth/login-verify-otp", response_model=schemas.AuthResponse)
def admin_login_verify_otp(payload: schemas.OTPVerifyRequest, db: Session = Depends(get_db)):
    return admin_verify_otp(payload, db)

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
        shipping_rate=payload.shipping_rate
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

@app.put("/api/admin/products/{product_id}/variants/{variant_id}", response_model=schemas.AdminVariantSchema)
def admin_update_variant(
    product_id: int,
    variant_id: str,
    payload: schemas.VariantUpdateRequest,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    variant = db.query(models.ProductVariant).filter_by(id=variant_id, product_id=product_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    updates = payload.dict(exclude_unset=True)
    for k, v in updates.items():
        if k == "selected_options" and v is not None:
            setattr(variant, k, [o if isinstance(o, dict) else o.dict() for o in v])
        else:
            setattr(variant, k, v)

    db.commit()
    db.refresh(variant)
    return schemas.AdminVariantSchema(
        id=variant.id, title=variant.title, available_for_sale=variant.available_for_sale,
        price_amount=variant.price_amount, price_currency=variant.price_currency,
        compare_at_price_amount=variant.compare_at_price_amount,
        inventory_quantity=variant.inventory_quantity, image_url=variant.image_url,
        selected_options=variant.selected_options or []
    )

@app.delete("/api/admin/products/{product_id}/variants/{variant_id}")
def admin_delete_variant(
    product_id: int,
    variant_id: str,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    variant = db.query(models.ProductVariant).filter_by(id=variant_id, product_id=product_id).first()
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
    user = db.query(models.User).options(selectinload(models.User.orders)).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    orders_count = len(user.orders)
    recent_orders = [
        {"id": o.id, "status": o.status, "total_amount": o.total_amount, "created_at": o.created_at.strftime("%b %d, %Y")}
        for o in sorted(user.orders, key=lambda o: o.created_at, reverse=True)[:5]
    ]
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_verified": user.is_verified,
        "is_active": user.is_active,
        "suspended_at": user.suspended_at.strftime("%b %d, %Y") if user.suspended_at else None,
        "suspension_reason": user.suspension_reason,
        "created_at": user.created_at.strftime("%b %d, %Y"),
        "orders_count": orders_count,
        "recent_orders": recent_orders
    }

@app.put("/api/admin/users/{user_id}/suspend")
def admin_suspend_user(
    user_id: int,
    payload: schemas.UserSuspendRequest,
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
    return {"message": f"User {user.email} suspended."}

@app.put("/api/admin/users/{user_id}/reactivate")
def admin_reactivate_user(
    user_id: int,
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
    return {"message": f"User {user.email} reactivated."}

@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account.")
    user = db.query(models.User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": f"User deleted permanently."}


# ============================================================
# ADMIN REVIEWS MANAGEMENT
# ============================================================

@app.get("/api/admin/reviews")
def admin_list_reviews(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    is_hidden: Optional[bool] = None,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.ProductReview).options(selectinload(models.ProductReview.product))
    if search:
        q = q.filter(
            (models.ProductReview.author.ilike(f"%{search}%")) | (models.ProductReview.content.ilike(f"%{search}%"))
        )
    if is_hidden is not None:
        q = q.filter(models.ProductReview.is_hidden == is_hidden)
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
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.ProductReview).filter_by(product_id=product_id)
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
