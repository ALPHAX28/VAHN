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
    tags = Column(JSON, default=list) # List of tags (strings)
    available_for_sale = Column(Boolean, default=True)
    options = Column(JSON, default=list) # Options like [{"name": "Colour", "values": ["Maroon"]}]
    featured_image_url = Column(String, nullable=True)
    featured_image_alt = Column(String, nullable=True)
    images = Column(JSON, default=list) # List of image objects [{"url": "...", "altText": "..."}]
    lookbook = Column(JSON, default=list) # List of lookbook items [{"id": "...", "imageUrl": "...", "title": "...", "description": "..."}]
    fit = Column(String, nullable=True) # e.g. "SLIM", "OVERSIZED", "REGULAR"
    kit_type = Column(String, nullable=True) # e.g. "HOME", "SIGNATURE", "JERSEY"
    activity = Column(String, nullable=True) # e.g. "FOOTBALL", "LIFESTYLE", "STREETWEAR"

    # Relationships
    collections = relationship("Collection", secondary=collection_product_association, back_populates="products")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    reviews = relationship("ProductReview", back_populates="product", cascade="all, delete-orphan")

class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(String, primary_key=True, index=True) # E.g., 'gid://shopify/ProductVariant/mock-1'
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    available_for_sale = Column(Boolean, default=True)
    price_amount = Column(Float, nullable=False)
    price_currency = Column(String, default="INR")
    compare_at_price_amount = Column(Float, nullable=True)
    compare_at_price_currency = Column(String, default="INR")
    image_url = Column(String, nullable=True)
    selected_options = Column(JSON, default=list) # Options e.g., [{"name": "Colour", "value": "Maroon"}]
    inventory_quantity = Column(Integer, default=10)

    # Relationships
    product = relationship("Product", back_populates="variants")

class Cart(Base):
    __tablename__ = "carts"

    id = Column(String, primary_key=True, index=True) # UUID or custom cart token string
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")

class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(String, primary_key=True, index=True) # UUID/token
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
    rating = Column(Float, nullable=False)
    title = Column(String, nullable=True)
    author = Column(String, nullable=False)
    date = Column(String, nullable=False)
    content = Column(String, nullable=False)
    verified = Column(Boolean, default=True)

    product = relationship("Product", back_populates="reviews")
