import re
from datetime import datetime
from typing import List, Optional, Generic, TypeVar
from pydantic import BaseModel, field_validator

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

T = TypeVar("T")

def validate_email_str(v: str) -> str:
    if not v or not EMAIL_REGEX.match(v.strip()):
        raise ValueError("Invalid email address format. Please provide a valid email (e.g. name@example.com).")
    return v.strip().lower()

# ============================================================
# Shared / Storefront Schemas
# ============================================================

class Money(BaseModel):
    amount: str
    currencyCode: str

class LookbookSchema(BaseModel):
    id: str
    imageUrl: str
    title: str
    description: str

class ReviewSchema(BaseModel):
    id: str
    rating: float
    title: Optional[str] = None
    author: str
    date: str
    content: str
    verified: bool

class ReviewCreate(BaseModel):
    rating: float
    title: Optional[str] = None
    author: str
    content: str

class ImageNode(BaseModel):
    url: str
    altText: Optional[str] = None
    width: int = 1000
    height: int = 1000

class SelectedOption(BaseModel):
    name: str
    value: str

class ProductVariant(BaseModel):
    id: str
    title: str
    availableForSale: bool
    selectedOptions: List[SelectedOption]
    price: Money
    compareAtPrice: Optional[Money] = None
    image: Optional[ImageNode] = None
    quantityAvailable: Optional[int] = None

class ProductOption(BaseModel):
    id: str
    name: str
    values: List[str]

class PriceRange(BaseModel):
    minVariantPrice: Money
    maxVariantPrice: Money

class CompareAtPriceRange(BaseModel):
    minVariantPrice: Money

class ImageEdge(BaseModel):
    node: ImageNode

class ImagesConnection(BaseModel):
    edges: List[ImageEdge]

class VariantEdge(BaseModel):
    node: ProductVariant

class VariantsConnection(BaseModel):
    edges: List[VariantEdge]

class SEO(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class StorefrontColourGroupImageSchema(BaseModel):
    url: str
    altText: Optional[str] = ""

class StorefrontColourGroupSchema(BaseModel):
    id: int
    colourValue: str
    displayOrder: Optional[int] = 0
    images: List[StorefrontColourGroupImageSchema] = []

class ProductSchema(BaseModel):
    id: str
    title: str
    handle: str
    description: str
    descriptionHtml: str
    vendor: str
    productType: str
    tags: List[str]
    availableForSale: bool
    options: List[ProductOption]
    priceRange: PriceRange
    compareAtPriceRange: CompareAtPriceRange
    images: ImagesConnection
    variants: VariantsConnection
    seo: SEO
    featuredImage: Optional[ImageNode] = None
    lookbook: List[LookbookSchema] = []
    reviews: List[ReviewSchema] = []
    colourGroups: List[StorefrontColourGroupSchema] = []
    fit: Optional[str] = None
    kitType: Optional[str] = None
    activity: Optional[str] = None
    gstPercent: Optional[float] = 12.0
    shippingRate: Optional[float] = None

class ProductEdge(BaseModel):
    node: ProductSchema
    cursor: str

class PageInfo(BaseModel):
    hasNextPage: bool
    endCursor: Optional[str] = None

class FilterValue(BaseModel):
    id: str
    label: str
    count: int
    input: str

class Filter(BaseModel):
    id: str
    label: str
    type: str
    values: List[FilterValue]

class CollectionProductsConnection(BaseModel):
    edges: List[ProductEdge]
    pageInfo: PageInfo
    filters: List[Filter] = []

class CollectionSchema(BaseModel):
    id: str
    handle: str
    title: str
    description: str
    descriptionHtml: str
    image: Optional[ImageNode] = None
    seo: SEO
    products: CollectionProductsConnection

# ---- Cart schemas ----

class CartProductMini(BaseModel):
    id: str
    title: str
    handle: str
    featuredImage: Optional[ImageNode] = None
    gstPercent: Optional[float] = 12.0
    shippingRate: Optional[float] = None

class CartMerchandise(BaseModel):
    id: str
    title: str
    price: Money
    selectedOptions: List[SelectedOption]
    product: CartProductMini
    quantityAvailable: Optional[int] = None

class CartLineCost(BaseModel):
    totalAmount: Money

class CartLine(BaseModel):
    id: str
    quantity: int
    merchandise: CartMerchandise
    cost: CartLineCost

class CartLineEdge(BaseModel):
    node: CartLine

class CartLinesConnection(BaseModel):
    edges: List[CartLineEdge]

class CartCost(BaseModel):
    subtotalAmount: Money
    totalAmount: Money
    totalTaxAmount: Money

class CartSchema(BaseModel):
    id: str
    totalQuantity: int
    lines: CartLinesConnection
    cost: CartCost

# ---- Cart Payload Schemas (Strict Pydantic Validation) ----

class CartAddItemPayload(BaseModel):
    merchandiseId: str
    quantity: int = 1

class CartUpdateItemPayload(BaseModel):
    quantity: int

# ============================================================
# User Auth & Profile Schemas
# ============================================================

class UserRegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str

    @field_validator('email')
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_str(v)

class UserLoginRequest(BaseModel):
    email: str
    password: str

    @field_validator('email')
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_str(v)

class OTPVerifyRequest(BaseModel):
    email: str
    otp_code: str

    @field_validator('email')
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_str(v)

class ProfileUpdateRequest(BaseModel):
    full_name: str

class RestockSubscriptionCreate(BaseModel):
    email: str
    product_id: int
    product_title: str
    product_handle: str
    colour_value: Optional[str] = None
    variant_id: Optional[str] = None

    @field_validator('email')
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_str(v)

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class UserSchema(BaseModel):
    id: int
    email: str
    full_name: str
    is_verified: bool
    created_at: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSchema

# ============================================================
# Order Schemas
# ============================================================

class UserAddressCreateRequest(BaseModel):
    label: str = "Home"
    first_name: str
    last_name: str
    street_address: str
    apartment: Optional[str] = None
    city: str
    state: str
    pincode: str
    country: str = "India"
    phone: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_default: bool = False

    @field_validator('country')
    @classmethod
    def validate_country(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in ["india", "in"]:
            raise ValueError("Shipping is currently only available within India.")
        return "India"

    @field_validator('pincode')
    @classmethod
    def validate_pincode(cls, v: str) -> str:
        clean = v.strip()
        import re
        if not re.match(r'^[1-9][0-9]{5}$', clean):
            raise ValueError("Please enter a valid 6-digit Indian PIN Code (e.g. 400001).")
        return clean

class UserAddressSchema(BaseModel):
    id: int
    user_id: int
    label: str
    first_name: str
    last_name: str
    street_address: str
    apartment: Optional[str]
    city: str
    state: str
    pincode: str
    country: str
    phone: str
    latitude: Optional[float]
    longitude: Optional[float]
    is_default: bool
    created_at: str

class ShippingAddress(BaseModel):
    name: Optional[str] = "Customer"
    address: Optional[str] = "Standard Delivery"
    city: Optional[str] = "City"
    postalCode: Optional[str] = "000000"
    phone: Optional[str] = ""

class CheckoutRequest(BaseModel):
    cart_id: str
    address_id: Optional[int] = None
    shipping_address: Optional[dict] = None

class OrderItemSchema(BaseModel):
    id: str
    variantId: Optional[str] = None
    productTitle: str
    variantTitle: str
    imageUrl: Optional[str] = None
    price: Money
    quantity: int

class OrderSchema(BaseModel):
    id: str
    status: str
    refundStatus: Optional[str] = None
    subtotalPrice: Money
    taxPrice: Money
    shippingPrice: Money
    discountPrice: Money
    totalPrice: Money
    shippingAddress: Optional[dict] = None
    createdAt: str
    items: List[OrderItemSchema]

# ============================================================
# Admin Auth Schemas
# ============================================================

class AdminRegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    admin_secret: str

    @field_validator('email')
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_str(v)

    @field_validator('password')
    @classmethod
    def check_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return v

class AdminLoginRequest(BaseModel):
    email: str
    password: str

    @field_validator('email')
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_str(v)

# ============================================================
# Admin Dashboard Schemas
# ============================================================

class RecentOrderItem(BaseModel):
    id: str
    user_email: str
    user_name: str
    status: str
    total_amount: float
    currency: str
    created_at: str
    items_count: int

class TopProductItem(BaseModel):
    product_id: int
    product_title: str
    total_sold: int
    total_revenue: float

class StockAlertItem(BaseModel):
    product_id: int
    product_title: str
    variant_id: str
    variant_title: str
    inventory_quantity: int
    available_for_sale: bool
    is_out_of_stock: bool

class DashboardStatsSchema(BaseModel):
    total_orders: int
    total_revenue: float
    total_users: int
    total_products: int
    pending_orders: int
    recent_orders: List[RecentOrderItem] = []
    top_products: List[TopProductItem] = []
    stock_alerts: List[StockAlertItem] = []

# ============================================================
# Admin Product CRUD Schemas
# ============================================================

class SelectedOptionInput(BaseModel):
    name: str
    value: str

class VariantCreateRequest(BaseModel):
    title: str
    price_amount: float
    compare_at_price_amount: Optional[float] = None
    inventory_quantity: int = 0
    available_for_sale: bool = True
    image_url: Optional[str] = None
    selected_options: List[SelectedOptionInput] = []

class VariantUpdateRequest(BaseModel):
    title: Optional[str] = None
    price_amount: Optional[float] = None
    compare_at_price_amount: Optional[float] = None
    inventory_quantity: Optional[int] = None
    available_for_sale: Optional[bool] = None
    image_url: Optional[str] = None
    selected_options: Optional[List[SelectedOptionInput]] = None

class ColourGroupCreateRequest(BaseModel):
    colour_value: str
    images: List[dict] = []  # [{url, altText}]
    display_order: int = 0

class ColourGroupUpdateRequest(BaseModel):
    colour_value: Optional[str] = None
    images: Optional[List[dict]] = None
    display_order: Optional[int] = None

class ColourGroupSchema(BaseModel):
    id: int
    product_id: int
    colour_value: str
    images: List[dict]
    display_order: int

class LookbookItemInput(BaseModel):
    id: str
    imageUrl: str
    title: str
    description: str

class ProductOptionInput(BaseModel):
    id: str
    name: str
    values: List[str]

class ProductCreateRequest(BaseModel):
    title: str
    handle: str
    description: Optional[str] = ""
    description_html: Optional[str] = ""
    vendor: str = "VAHN"
    product_type: Optional[str] = ""
    tags: List[str] = []
    available_for_sale: bool = True
    options: List[ProductOptionInput] = []
    featured_image_url: Optional[str] = None
    featured_image_alt: Optional[str] = None
    images: List[dict] = []
    lookbook: List[LookbookItemInput] = []
    fit: Optional[str] = None
    kit_type: Optional[str] = None
    activity: Optional[str] = None
    gst_percent: float = 12.0
    shipping_rate: Optional[float] = None
    variants: List[VariantCreateRequest] = []

class ProductUpdateRequest(BaseModel):
    title: Optional[str] = None
    handle: Optional[str] = None
    description: Optional[str] = None
    description_html: Optional[str] = None
    vendor: Optional[str] = None
    product_type: Optional[str] = None
    tags: Optional[List[str]] = None
    available_for_sale: Optional[bool] = None
    options: Optional[List[ProductOptionInput]] = None
    featured_image_url: Optional[str] = None
    featured_image_alt: Optional[str] = None
    images: Optional[List[dict]] = None
    lookbook: Optional[List[LookbookItemInput]] = None
    fit: Optional[str] = None
    kit_type: Optional[str] = None
    activity: Optional[str] = None
    gst_percent: Optional[float] = None
    shipping_rate: Optional[float] = None

class AdminVariantSchema(BaseModel):
    id: str
    title: str
    available_for_sale: bool
    price_amount: float
    price_currency: str
    compare_at_price_amount: Optional[float] = None
    inventory_quantity: int
    image_url: Optional[str] = None
    selected_options: List[dict]

class AdminProductSummary(BaseModel):
    id: int
    title: str
    handle: str
    vendor: str
    available_for_sale: bool
    product_type: Optional[str]
    featured_image_url: Optional[str]
    tags: List[str]
    fit: Optional[str]
    kit_type: Optional[str]
    activity: Optional[str]
    gst_percent: float
    shipping_rate: Optional[float]
    variants_count: int
    created_at: Optional[str]

class AdminProductDetail(BaseModel):
    id: int
    title: str
    handle: str
    description: Optional[str]
    description_html: Optional[str]
    vendor: str
    product_type: Optional[str]
    tags: List[str]
    available_for_sale: bool
    options: List[dict]
    featured_image_url: Optional[str]
    featured_image_alt: Optional[str]
    images: List[dict]
    lookbook: List[dict]
    fit: Optional[str]
    kit_type: Optional[str]
    activity: Optional[str]
    gst_percent: float
    shipping_rate: Optional[float]
    variants: List[AdminVariantSchema]
    colour_groups: List[ColourGroupSchema]
    created_at: Optional[str]
    updated_at: Optional[str]

# ============================================================
# Admin Collection Schemas
# ============================================================

class CollectionCreateRequest(BaseModel):
    title: str
    handle: str
    description: Optional[str] = ""
    description_html: Optional[str] = ""
    image_url: Optional[str] = None
    image_alt: Optional[str] = None

class CollectionUpdateRequest(BaseModel):
    title: Optional[str] = None
    handle: Optional[str] = None
    description: Optional[str] = None
    description_html: Optional[str] = None
    image_url: Optional[str] = None
    image_alt: Optional[str] = None

class CollectionProductsUpdateRequest(BaseModel):
    product_ids: List[int]
    action: str  # "attach" | "detach"

class AdminCollectionSchema(BaseModel):
    id: int
    title: str
    handle: str
    description: Optional[str]
    image_url: Optional[str]
    products_count: int

# ============================================================
# Admin Order Schemas
# ============================================================

class OrderStatusUpdateRequest(BaseModel):
    status: Optional[str] = None          # PROCESSING | SHIPPED | DELIVERED | CANCELLED
    refund_status: Optional[str] = None   # PENDING | REFUNDED
    refund_note: Optional[str] = None

class AdminOrderItemSchema(BaseModel):
    id: str
    variant_id: Optional[str]
    product_title: str
    variant_title: str
    image_url: Optional[str]
    price_amount: float
    quantity: int

class AdminOrderSchema(BaseModel):
    id: str
    status: str
    refund_status: Optional[str]
    refund_note: Optional[str]
    subtotal_amount: float
    total_amount: float
    currency: str
    shipping_address: Optional[dict]
    created_at: str
    updated_at: Optional[str]
    user_id: int
    user_email: str
    user_name: str
    items: List[AdminOrderItemSchema]

class AdminOrderSummary(BaseModel):
    id: str
    status: str
    refund_status: Optional[str]
    total_amount: float
    currency: str
    created_at: str
    user_email: str
    user_name: str
    items_count: int

# ============================================================
# Admin User Schemas
# ============================================================

class UserSuspendRequest(BaseModel):
    reason: Optional[str] = None

class AdminUserSchema(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_verified: bool
    is_active: bool
    suspended_at: Optional[str]
    suspension_reason: Optional[str]
    created_at: str
    orders_count: int

# ============================================================
# Admin Review Schemas
# ============================================================

class ReviewAdminUpdateRequest(BaseModel):
    is_hidden: Optional[bool] = None
    is_approved: Optional[bool] = None
    content: Optional[str] = None
    rating: Optional[float] = None
    title: Optional[str] = None

class AdminReviewCreateRequest(BaseModel):
    rating: float
    title: Optional[str] = None
    author: str
    content: str
    verified: bool = True
    is_approved: bool = True

class AdminReviewSchema(BaseModel):
    id: int
    product_id: int
    product_title: str
    rating: float
    title: Optional[str]
    author: str
    date: str
    content: str
    verified: bool
    is_approved: bool
    is_hidden: bool
    created_at: Optional[str]

# ============================================================
# Media Asset Schemas
# ============================================================

class MediaAssetConfirmRequest(BaseModel):
    url: str
    key: Optional[str] = None
    size: Optional[int] = None
    mime_type: Optional[str] = None
    alt_text: Optional[str] = None
    provider: str = "uploadthing"

class MediaAssetSchema(BaseModel):
    id: int
    url: str
    provider: str
    key: Optional[str]
    size: Optional[int]
    mime_type: Optional[str]
    alt_text: Optional[str]
    uploaded_by_id: Optional[int]
    created_at: str

# ============================================================
# Pagination Wrapper
# ============================================================

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
