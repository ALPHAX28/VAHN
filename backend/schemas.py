import re
from typing import List, Optional
from pydantic import BaseModel, field_validator

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

def validate_email_str(v: str) -> str:
    if not v or not EMAIL_REGEX.match(v.strip()):
        raise ValueError("Invalid email address format. Please provide a valid email (e.g. name@example.com).")
    return v.strip().lower()

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
    fit: Optional[str] = None
    kitType: Optional[str] = None
    activity: Optional[str] = None

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

# ---- User Auth & Profile Schemas ----

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

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class UserSchema(BaseModel):
    id: int
    email: str
    full_name: str
    is_verified: bool

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSchema

# ---- Order Schemas ----

class ShippingAddress(BaseModel):
    name: Optional[str] = "Customer"
    address: Optional[str] = "Standard Delivery"
    city: Optional[str] = "City"
    postalCode: Optional[str] = "000000"
    phone: Optional[str] = ""

class CheckoutRequest(BaseModel):
    cart_id: str
    shipping_address: Optional[ShippingAddress] = None

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
    subtotalPrice: Money
    totalPrice: Money
    shippingAddress: Optional[ShippingAddress] = None
    createdAt: str
    items: List[OrderItemSchema]
