import secrets
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, selectinload

from database import Base, engine, get_db
import models
import schemas
from email_service import send_otp_email
from auth_utils import generate_salt, hash_password, verify_password, create_access_token, get_current_user

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
        activity=prod.activity
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
def register(payload: schemas.UserRegisterRequest, db: Session = Depends(get_db)):
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
        send_otp_email(email, otp, subject="Your VAHN Sign-Up Verification Code")
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

    send_otp_email(email, otp, subject="Your VAHN Sign-Up Verification Code")
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

    token = create_access_token(user.id, user.email)
    user_schema = schemas.UserSchema(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_verified=user.is_verified
    )
    return schemas.AuthResponse(access_token=token, token_type="bearer", user=user_schema)

@app.post("/api/auth/login")
def login(payload: schemas.UserLoginRequest, db: Session = Depends(get_db)):
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

    send_otp_email(email, otp, subject="Your VAHN Login Verification Code")
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

    return schemas.OrderSchema(
        id=order.id,
        status=order.status,
        subtotalPrice=schemas.Money(amount=f"{order.subtotal_amount:.2f}", currencyCode=order.currency),
        totalPrice=schemas.Money(amount=f"{order.total_amount:.2f}", currencyCode=order.currency),
        shippingAddress=shipping_addr,
        createdAt=order.created_at.strftime("%b %d, %Y"),
        items=item_schemas
    )

@app.post("/api/orders/checkout", response_model=schemas.OrderSchema)
def checkout(payload: schemas.CheckoutRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    cart = db.query(models.Cart).options(
        selectinload(models.Cart.items).selectinload(models.CartItem.variant).selectinload(models.ProductVariant.product)
    ).filter_by(id=payload.cart_id).first()

    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty or not found.")

    order_id = f"ORD-{secrets.randbelow(899999) + 100000}"
    subtotal = 0.0

    order = models.Order(
        id=order_id,
        user_id=current_user.id,
        status="PROCESSING",
        subtotal_amount=0.0,
        total_amount=0.0,
        currency="INR",
        shipping_address=payload.shipping_address.dict() if payload.shipping_address else {
            "name": current_user.full_name,
            "address": "Standard Express Shipping",
            "city": "Mumbai",
            "postalCode": "400001",
            "phone": "+91 9876543210"
        }
    )
    db.add(order)
    db.flush()

    for item in cart.items:
        var = item.variant
        prod = var.product if var else None
        item_price = var.price_amount if var else 0.0
        line_total = item_price * item.quantity
        subtotal += line_total

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

    order.subtotal_amount = subtotal
    order.total_amount = subtotal

    # Empty cart after checkout
    for item in cart.items:
        db.delete(item)

    db.commit()
    db.refresh(order)
    return build_order_schema(order)

@app.get("/api/orders", response_model=List[schemas.OrderSchema])
def get_user_orders(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.query(models.Order).options(selectinload(models.Order.items)).filter_by(user_id=current_user.id).order_by(models.Order.created_at.desc()).all()
    return [build_order_schema(o) for o in orders]
