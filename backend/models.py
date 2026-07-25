from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey, Table, JSON
from sqlalchemy.orm import relationship
from database import Base

# Association table for Collection & Product (Many-to-Many)
collection_product_association = Table(
    "collection_products",
    Base.metadata,
    Column("collection_id", Integer, ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True),
    Column("product_id", Integer, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
)

class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    handle = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    description_html = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    image_alt = Column(String, nullable=True)

    # Relationships
    products = relationship("Product", secondary=collection_product_association, back_populates="collections")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    handle = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    description_html = Column(Text, nullable=True)
    vendor = Column(String, default="VAHN")
    product_type = Column(String, nullable=True)
    tags = Column(JSON, default=list)  # List of tag strings
    available_for_sale = Column(Boolean, default=True)
    options = Column(JSON, default=list)  # [{name: "Colour", values: ["Maroon"]}]
    featured_image_url = Column(String, nullable=True)
    featured_image_alt = Column(String, nullable=True)
    images = Column(JSON, default=list)  # [{url, altText}]
    lookbook = Column(JSON, default=list)  # [{id, imageUrl, title, description}]
    fit = Column(String, nullable=True)      # SLIM | OVERSIZED | REGULAR
    kit_type = Column(String, nullable=True) # HOME | SIGNATURE | JERSEY
    activity = Column(String, nullable=True) # FOOTBALL | LIFESTYLE | STREETWEAR
    gst_percent = Column(Float, default=12.0, nullable=False)  # GST % (e.g. 5, 12, 18, 28)
    shipping_rate = Column(Float, nullable=True)               # Per-product flat shipping fee (None = use global rule)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    collections = relationship("Collection", secondary=collection_product_association, back_populates="products")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    reviews = relationship("ProductReview", back_populates="product", cascade="all, delete-orphan")
    colour_groups = relationship("ProductColourGroup", back_populates="product", cascade="all, delete-orphan")

class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(String, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    available_for_sale = Column(Boolean, default=True)
    price_amount = Column(Float, nullable=False)
    price_currency = Column(String, default="INR")
    compare_at_price_amount = Column(Float, nullable=True)
    compare_at_price_currency = Column(String, default="INR")
    image_url = Column(String, nullable=True)
    selected_options = Column(JSON, default=list)  # [{name: "Colour", value: "Maroon"}]
    inventory_quantity = Column(Integer, default=10)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    product = relationship("Product", back_populates="variants")

class ProductColourGroup(Base):
    """Groups images per colour value for a product (e.g. Maroon → [img1, img2, img3])."""
    __tablename__ = "product_colour_groups"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    colour_value = Column(String, nullable=False)  # e.g. "Maroon"
    images = Column(JSON, default=list)            # [{url, altText}]
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    product = relationship("Product", back_populates="colour_groups")

class Cart(Base):
    __tablename__ = "carts"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")

class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(String, primary_key=True, index=True)
    cart_id = Column(String, ForeignKey("carts.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(String, ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, default=1)

    # Relationships
    cart = relationship("Cart", back_populates="items")
    variant = relationship("ProductVariant")

class ProductReview(Base):
    __tablename__ = "product_reviews"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    rating = Column(Float, nullable=False)
    title = Column(String, nullable=True)
    author = Column(String, nullable=False)
    date = Column(String, nullable=False)
    content = Column(String, nullable=False)
    verified = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=True)
    is_hidden = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = relationship("Product", back_populates="reviews")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    salt = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default="customer")  # customer | admin
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    suspended_at = Column(DateTime, nullable=True)
    suspension_reason = Column(String, nullable=True)
    otp_code = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
    addresses = relationship("UserAddress", back_populates="user", cascade="all, delete-orphan")

class UserAddress(Base):
    __tablename__ = "user_addresses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    label = Column(String, default="Home") # Home | Work | Office | Studio | Custom
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    street_address = Column(String, nullable=False)
    apartment = Column(String, nullable=True)
    city = Column(String, nullable=False)
    state = Column(String, nullable=False)
    pincode = Column(String, nullable=False) # 6-digit Indian PIN Code
    country = Column(String, default="India") # Fixed to India
    phone = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="addresses")

class StoreSetting(Base):
    __tablename__ = "store_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)

class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, index=True)  # e.g. ORD-894721
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="PROCESSING")  # PROCESSING | SHIPPED | DELIVERED | CANCELLED
    refund_status = Column(String, nullable=True)   # PENDING | REFUNDED
    refund_note = Column(Text, nullable=True)
    subtotal_amount = Column(Float, nullable=False)
    shipping_amount = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    shipping_address = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(String, primary_key=True, index=True)
    order_id = Column(String, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(String, nullable=True)
    product_title = Column(String, nullable=False)
    variant_title = Column(String, nullable=False)
    image_url = Column(String, nullable=True)
    price_amount = Column(Float, nullable=False)
    quantity = Column(Integer, default=1)

    # Relationships
    order = relationship("Order", back_populates="items")

class MediaAsset(Base):
    """Future-proof media asset tracking table — provider-agnostic."""
    __tablename__ = "media_assets"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, nullable=False)
    provider = Column(String, default="uploadthing")  # uploadthing | s3
    key = Column(String, nullable=True)               # Storage key/path
    size = Column(Integer, nullable=True)             # Bytes
    mime_type = Column(String, nullable=True)
    alt_text = Column(String, nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])
