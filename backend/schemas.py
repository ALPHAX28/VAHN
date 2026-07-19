from typing import List, Optional
from pydantic import BaseModel

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
