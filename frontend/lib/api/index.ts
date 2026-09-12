import { cache } from 'react';
import { fetchAPI } from './client';
import type {
  Product,
  Collection,
  CollectionListItem,
  Cart,
  Blog,
  Article,
  ShopifyPage,
  Menu,
} from './types';

// ---- Products ----

export const getProduct = cache(async (handle: string): Promise<Product | null> => {
  return fetchAPI<Product>(`/products/${handle}`, { cache: 'no-store' }).catch(() => null);
});

export async function getProducts(_options?: {
  first?: number;
  query?: string;
  sortKey?: string;
  reverse?: boolean;
  after?: string;
}): Promise<{ products: Product[]; hasNextPage: boolean; endCursor: string | null }> {
  try {
    const products = await fetchAPI<Product[]>('/products', { cache: 'no-store' });
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

export async function getProductRecommendations(productId: string, handle?: string): Promise<Product[]> {
  const products = await fetchAPI<Product[]>('/products', { cache: 'no-store' }).catch(() => []);
  const cleanId = (id: string) => id.replace(/^gid:\/\/shopify\/Product\//, '');
  const targetId = cleanId(productId);
  return products.filter((p) => cleanId(p.id) !== targetId && (!handle || p.handle !== handle));
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
  return fetchAPI<Collection>(`/collections/${handle}`, { cache: 'no-store' }).catch(() => null);
}

export async function getCollections(): Promise<CollectionListItem[]> {
  return fetchAPI<CollectionListItem[]>('/collections', { cache: 'no-store' }).catch(() => []);
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

export async function syncCart(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  return fetchAPI<Cart>(`/cart/${cartId}`, {
    method: 'PUT',
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
  return fetchAPI<Cart>(`/cart/${cartId}`, { cache: 'no-store' }).catch(() => null);
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

import { STATIC_PAGES } from '@/lib/data/pages';

export async function getPage(handle: string): Promise<ShopifyPage | null> {
  const normalized = handle.toLowerCase().trim();
  if (STATIC_PAGES[normalized]) {
    return STATIC_PAGES[normalized];
  }
  return {
    id: `page-${handle}`,
    title: handle.charAt(0).toUpperCase() + handle.slice(1).replace(/-/g, ' '),
    handle,
    body: '<p>This is a standalone page for VAHN.</p>',
    bodySummary: 'Standalone page.',
    seo: { title: handle, description: 'Standalone page.' }
  };
}

// ---- Menu ----

export async function getMenu(_handle: string): Promise<Menu | null> {
  return {
    items: [
      { id: 'menu-home', title: 'Home', url: '/', items: [] },
      { id: 'menu-shop', title: 'Shop', url: '/products', items: [] },
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

// ---- User Address & Order API Functions ----

export async function getUserAddresses(token: string): Promise<import('./types').UserAddress[]> {
  return fetchAPI<import('./types').UserAddress[]>('/user/addresses', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function createUserAddress(token: string, data: Partial<import('./types').UserAddress>): Promise<import('./types').UserAddress> {
  return fetchAPI<import('./types').UserAddress>('/user/addresses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: data
  });
}

export async function updateUserAddress(token: string, addressId: number, data: Partial<import('./types').UserAddress>): Promise<import('./types').UserAddress> {
  return fetchAPI<import('./types').UserAddress>(`/user/addresses/${addressId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: data
  });
}


export async function setDefaultAddress(token: string, addressId: number): Promise<void> {
  return fetchAPI<void>(`/user/addresses/${addressId}/default`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function deleteUserAddress(token: string, addressId: number): Promise<void> {
  return fetchAPI<void>(`/user/addresses/${addressId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function getOrderDetail(token: string, orderId: string): Promise<import('./types').OrderDetail> {
  return fetchAPI<import('./types').OrderDetail>(`/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function checkoutCart(token: string, cartId: string, addressId?: number, shippingAddress?: any): Promise<import('./types').OrderDetail> {
  return fetchAPI<import('./types').OrderDetail>('/orders/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { cart_id: cartId, address_id: addressId, shipping_address: shippingAddress }
  });
}

export async function createRestockSubscription(payload: {
  email: string;
  product_id: number;
  product_title: string;
  product_handle: string;
  colour_value?: string;
  variant_id?: string;
}): Promise<{ message: string; id: number }> {
  return fetchAPI<{ message: string; id: number }>('/restock-subscriptions', {
    method: 'POST',
    body: payload,
  });
}

// ---- Notification / Announcement Banners ----

export async function getActiveAnnouncements(): Promise<import('./types').NotificationBanner[]> {
  return fetchAPI<import('./types').NotificationBanner[]>('/announcements/active', {
    cache: 'no-store',
  }).catch(() => []);
}

// ---- Logistics, Prepaid Payments & Returns ----

export async function checkShippingServiceability(pincode: string): Promise<import('./types').ServiceabilityResponse> {
  return fetchAPI<import('./types').ServiceabilityResponse>('/shipping/serviceability', {
    method: 'POST',
    body: { pincode },
  });
}

export async function createRazorpayOrder(
  payload: {
    cart_id: string;
    address_id?: number;
    shipping_address?: any;
    discount_code?: string;
  },
  token?: string
): Promise<import('./types').RazorpayOrderResponse> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetchAPI<import('./types').RazorpayOrderResponse>('/payments/razorpay/create-order', {
    method: 'POST',
    headers,
    body: payload,
  });
}

export async function verifyRazorpayPayment(
  payload: {
    cart_id: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    address_id?: number;
    shipping_address?: any;
    order_id?: string;
  },
  token?: string
): Promise<{ success?: boolean; id: string; order_id: string; status?: string; message?: string }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetchAPI<{ success?: boolean; id: string; order_id: string; status?: string; message?: string }>('/payments/razorpay/verify', {
    method: 'POST',
    headers,
    body: payload,
  });
}

export async function createMagicCheckoutOrder(payload: {
  cart_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  shipping_address: any;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  discount_code?: string;
}): Promise<import('./types').OrderDetail> {
  return fetchAPI<import('./types').OrderDetail>('/orders/magic-checkout', {
    method: 'POST',
    body: payload,
  });
}

export async function getPublicTracking(query: string): Promise<import('./types').TrackingInfo> {
  return fetchAPI<import('./types').TrackingInfo>(`/shipping/track/${encodeURIComponent(query.trim())}`);
}

export async function getOrderTracking(orderId: string, token?: string): Promise<import('./types').TrackingInfo> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetchAPI<import('./types').TrackingInfo>(`/orders/${orderId}/tracking`, {
    headers,
  });
}

export async function cancelOrder(orderId: string, reason?: string, token?: string): Promise<{ message: string; order_id: string; refund_id?: string; status: string }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetchAPI<{ message: string; order_id: string; refund_id?: string; status: string }>(`/orders/${orderId}/cancel`, {
    method: 'POST',
    headers,
    body: { reason },
  });
}

export async function requestOrderReturn(
  orderId: string,
  reason: string,
  notes?: string,
  token?: string
): Promise<{ message: string; order_id: string; return_status: string; reverse_awb?: string; reverse_courier_name?: string }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetchAPI<{ message: string; order_id: string; return_status: string; reverse_awb?: string; reverse_courier_name?: string }>(`/orders/${orderId}/return`, {
    method: 'POST',
    headers,
    body: { reason, notes },
  });
}


