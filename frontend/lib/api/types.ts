// ===================================================================
// Shopify Storefront API — TypeScript Types
// ===================================================================

export interface Money {
  amount: string;
  currencyCode: string;
}

export interface Image {
  url: string;
  altText: string | null;
  width: number;
  height: number;
}

export interface SelectedOption {
  name: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: SelectedOption[];
  price: Money;
  compareAtPrice: Money | null;
  image: Image | null;
  quantityAvailable?: number;
}

export interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  availableForSale: boolean;
  options: { id: string; name: string; values: string[] }[];
  priceRange: {
    minVariantPrice: Money;
    maxVariantPrice: Money;
  };
  compareAtPriceRange: {
    minVariantPrice: Money;
  };
  images: { edges: { node: Image }[] };
  variants: { edges: { node: ProductVariant }[] };
  seo: { title: string | null; description: string | null };
  featuredImage: Image | null;
  lookbook?: LookbookItem[];
  reviews?: Review[];
}

export interface LookbookItem {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
}

export interface Review {
  id: string;
  rating: number;
  title?: string;
  author: string;
  date: string;
  content: string;
  verified: boolean;
}

export interface Collection {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  image: Image | null;
  seo: { title: string | null; description: string | null };
  products: {
    edges: { node: Product; cursor: string }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    filters: Filter[];
  };
}

export interface Filter {
  id: string;
  label: string;
  type: string;
  values: FilterValue[];
}

export interface FilterValue {
  id: string;
  label: string;
  count: number;
  input: string;
}

// ---- Cart ----

export interface CartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    selectedOptions: SelectedOption[];
    product: {
      id: string;
      title: string;
      handle: string;
      featuredImage: Image | null;
    };
    price: Money;
    quantityAvailable?: number;
  };
  cost: {
    totalAmount: Money;
  };
}

export interface Cart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  lines: { edges: { node: CartLine }[] };
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
    totalTaxAmount: Money | null;
  };
  discountCodes: { code: string; applicable: boolean }[];
}

// ---- Blog ----

export interface Article {
  id: string;
  handle: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  publishedAt: string;
  author: { name: string };
  image: Image | null;
  blog: { handle: string; title: string };
  seo: { title: string | null; description: string | null };
}

export interface Blog {
  id: string;
  handle: string;
  title: string;
  articles: {
    edges: { node: Article }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

// ---- Page ----

export interface ShopifyPage {
  id: string;
  handle: string;
  title: string;
  body: string;
  bodySummary: string;
  seo: { title: string | null; description: string | null };
}

// ---- Search ----

export interface SearchResult {
  products: { edges: { node: Product }[] };
  articles: { edges: { node: Article }[] };
  pages: { edges: { node: ShopifyPage }[] };
}

// ---- Menu ----

export interface MenuItem {
  id: string;
  title: string;
  url: string;
  items: MenuItem[];
}

export interface Menu {
  items: MenuItem[];
}
