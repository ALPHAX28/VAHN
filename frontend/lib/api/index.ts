/* eslint-disable @typescript-eslint/no-unused-vars */
import { fetchAPI } from './client';
import type {
  Product,
  Collection,
  Cart,
  Blog,
  Article,
  ShopifyPage,
  Menu,
} from './types';

// ---- Products ----

export async function getProduct(handle: string): Promise<Product | null> {
  return fetchAPI<Product>(`/products/${handle}`).catch(() => null);
}

export async function getProducts(_options?: {
  first?: number;
  query?: string;
  sortKey?: string;
  reverse?: boolean;
  after?: string;
}): Promise<{ products: Product[]; hasNextPage: boolean; endCursor: string | null }> {
  try {
    const products = await fetchAPI<Product[]>('/products');
    return {
      products,
      hasNextPage: false,
      endCursor: null
    };
  } catch {
    return {
      products: [],
      hasNextPage: false,
      endCursor: null
    };
  }
}

export async function getProductRecommendations(_productId: string): Promise<Product[]> {
  return fetchAPI<Product[]>('/products').catch(() => []);
}

// ---- Collections ----

export async function getCollection(
  handle: string,
  _options: {
    first?: number;
    after?: string;
    sortKey?: string;
    reverse?: boolean;
    filters?: Record<string, string>[];
  } = {}
): Promise<Collection | null> {
  return fetchAPI<Collection>(`/collections/${handle}`).catch(() => null);
}

export async function getCollections(): Promise<Collection[]> {
  // Return list with the default collection
  const beginning = await getCollection('vahn-beginning');
  return beginning ? [beginning] : [];
}

// ---- Cart ----

export async function createCart(
  lines: { merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  return fetchAPI<Cart>('/cart', {
    method: 'POST',
    body: lines
  });
}

export async function addToCart(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  // Use first line item from request payload
  return fetchAPI<Cart>(`/cart/${cartId}/items`, {
    method: 'POST',
    body: lines[0]
  });
}

export async function updateCart(
  cartId: string,
  lines: { id: string; quantity: number }[]
): Promise<Cart> {
  return fetchAPI<Cart>(`/cart/${cartId}/items/${lines[0].id}`, {
    method: 'PUT',
    body: { quantity: lines[0].quantity }
  });
}

export async function removeFromCart(cartId: string, lineIds: string[]): Promise<Cart> {
  return fetchAPI<Cart>(`/cart/${cartId}/items/${lineIds[0]}`, {
    method: 'DELETE'
  });
}

export async function getCart(cartId: string): Promise<Cart | null> {
  return fetchAPI<Cart>(`/cart/${cartId}`).catch(() => null);
}

// ---- Blog ----

export async function getBlog(
  handle: string,
  _options: { first?: number; after?: string } = {}
): Promise<Blog | null> {
  return {
    id: 'mock-blog',
    handle: 'news',
    title: 'VAHN News',
    articles: {
      edges: [],
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    }
  };
}

export async function getArticle(
  _blogHandle: string,
  _articleHandle: string
): Promise<Article | null> {
  return null;
}

// ---- Pages ----

export async function getPage(handle: string): Promise<ShopifyPage | null> {
  return {
    id: 'mock-page',
    title: handle.charAt(0).toUpperCase() + handle.slice(1),
    handle,
    body: '<p>This is a standalone placeholder page for VAHN.</p>',
    bodySummary: 'Standalone placeholder page.',
    seo: { title: handle, description: 'Standalone page.' }
  };
}

// ---- Menu ----

export async function getMenu(_handle: string): Promise<Menu | null> {
  return {
    items: [
      { id: 'menu-home', title: 'Home', url: '/', items: [] },
      { id: 'menu-shop', title: 'Shop', url: '/collections/vahn-beginning', items: [] },
      { id: 'menu-about', title: 'Our Story', url: '/pages/about', items: [] }
    ]
  };
}

// ---- Search ----

export async function predictiveSearch(query: string) {
  try {
    const products = await fetchAPI<Product[]>('/products');
    const filtered = products.filter((p) =>
      p.title.toLowerCase().includes(query.toLowerCase())
    );
    return {
      products: filtered.map((p) => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
        featuredImage: p.featuredImage ? { url: p.featuredImage.url, altText: p.featuredImage.altText } : null,
        priceRange: { minVariantPrice: p.priceRange.minVariantPrice }
      })),
      collections: [],
      pages: []
    };
  } catch {
    return { products: [], collections: [], pages: [] };
  }
}
