/**
 * VAHN Admin API Client
 * All typed API calls for the admin panel.
 * Uses adminToken from AdminAuthContext.
 */

import { getApiBaseUrl } from "./client";

// ============================================================
// Type Definitions
// ============================================================

export interface AdminProductSummary {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  available_for_sale: boolean;
  product_type: string | null;
  featured_image_url: string | null;
  tags: string[];
  fit: string | null;
  kit_type: string | null;
  activity: string | null;
  gst_percent: number;
  shipping_rate: number | null;
  variants_count: number;
  created_at: string | null;
}

export interface AdminVariant {
  id: string;
  title: string;
  available_for_sale: boolean;
  price_amount: number;
  price_currency: string;
  compare_at_price_amount: number | null;
  inventory_quantity: number;
  image_url: string | null;
  selected_options: Array<{ name: string; value: string }>;
}

export interface ColourGroup {
  id: number;
  product_id: number;
  colour_value: string;
  images: Array<{ url: string; altText?: string }>;
  display_order: number;
}

export interface AdminProductDetail extends AdminProductSummary {
  description: string | null;
  description_html: string | null;
  options: Array<{ id: string; name: string; values: string[] }>;
  featured_image_alt: string | null;
  images: Array<{ url: string; altText?: string }>;
  lookbook: Array<{ id: string; imageUrl: string; title: string; description: string }>;
  variants: AdminVariant[];
  colour_groups: ColourGroup[];
  updated_at: string | null;
}

export interface AdminOrder {
  id: string;
  status: string;
  refund_status: string | null;
  refund_note: string | null;
  subtotal_amount: number;
  total_amount: number;
  currency: string;
  shipping_address: Record<string, string> | null;
  created_at: string;
  updated_at: string | null;
  user_id: number;
  user_email: string;
  user_name: string;
  items: Array<{
    id: string;
    variant_id: string | null;
    product_title: string;
    variant_title: string;
    image_url: string | null;
    price_amount: number;
    quantity: number;
  }>;
}

export interface AdminOrderSummary {
  id: string;
  status: string;
  refund_status: string | null;
  total_amount: number;
  currency: string;
  created_at: string;
  user_email: string;
  user_name: string;
  items_count: number;
}

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
  orders_count: number;
}

export interface AdminReview {
  id: number;
  product_id: number;
  product_title: string;
  rating: number;
  title: string | null;
  author: string;
  date: string;
  content: string;
  verified: boolean;
  is_approved: boolean;
  is_hidden: boolean;
  created_at: string | null;
}

export interface AdminCollection {
  id: number;
  title: string;
  handle: string;
  description: string | null;
  image_url: string | null;
  products_count: number;
}

export interface DashboardStats {
  total_orders: number;
  total_revenue: number;
  total_users: number;
  total_products: number;
  pending_orders: number;
  recent_orders: Array<{
    id: string;
    user_email: string;
    user_name: string;
    status: string;
    total_amount: number;
    currency: string;
    created_at: string;
    items_count: number;
  }>;
  top_products: Array<{
    product_id: number;
    product_title: string;
    total_sold: number;
    total_revenue: number;
  }>;
  stock_alerts: Array<{
    product_id: number;
    product_title: string;
    variant_id: string;
    variant_title: string;
    inventory_quantity: number;
    available_for_sale: boolean;
    is_out_of_stock: boolean;
  }>;
}

export interface MediaAsset {
  id: number;
  url: string;
  provider: string;
  key: string | null;
  size: number | null;
  mime_type: string | null;
  alt_text: string | null;
  uploaded_by_id: number | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

import { clientCache } from "./cache";

// ============================================================
// Core Fetch Helper
// ============================================================

async function adminFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const baseUrl = getApiBaseUrl();

  const networkFetcher = async (): Promise<T> => {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || `Request failed: ${res.status}`);
    }
    return data as T;
  };

  // If GET request, use SWR client cache for instant 0ms response!
  if (method === "GET") {
    const cacheKey = `admin:${token.slice(0, 10)}:${path}`;
    return clientCache.fetchWithCache<T>(cacheKey, networkFetcher);
  }

  // For mutations (POST, PUT, DELETE), execute network call and invalidate cache!
  const result = await networkFetcher();
  clientCache.invalidate("admin:");
  return result;
}

// ============================================================
// Dashboard
// ============================================================

export const getDashboardStats = (token: string) =>
  adminFetch<DashboardStats>("/admin/dashboard/stats", token);

// ============================================================
// Products
// ============================================================

export const getAdminProducts = (token: string, params?: { page?: number; search?: string; available_only?: boolean }) => {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.search) q.set("search", params.search);
  if (params?.available_only !== undefined) q.set("available_only", String(params.available_only));
  return adminFetch<PaginatedResponse<AdminProductSummary>>(`/admin/products?${q}`, token);
};

export const getAdminProduct = (token: string, id: number) =>
  adminFetch<AdminProductDetail>(`/admin/products/${id}`, token);

export const createAdminProduct = (token: string, data: object) =>
  adminFetch<AdminProductDetail>("/admin/products", token, { method: "POST", body: JSON.stringify(data) });

export const updateAdminProduct = (token: string, id: number, data: object) =>
  adminFetch<AdminProductDetail>(`/admin/products/${id}`, token, { method: "PUT", body: JSON.stringify(data) });

export const deleteAdminProduct = (token: string, id: number, hard = false) =>
  adminFetch<{ message: string }>(`/admin/products/${id}?hard_delete=${hard}`, token, { method: "DELETE" });

// ============================================================
// Variants
// ============================================================

export const addVariant = (token: string, productId: number, data: object) =>
  adminFetch<AdminVariant>(`/admin/products/${productId}/variants`, token, { method: "POST", body: JSON.stringify(data) });

export const updateVariant = (token: string, productId: number, variantId: string, data: object) =>
  adminFetch<AdminVariant>(`/admin/products/${productId}/variants/${encodeURIComponent(variantId)}`, token, { method: "PUT", body: JSON.stringify(data) });

export const deleteVariant = (token: string, productId: number, variantId: string) =>
  adminFetch<{ message: string }>(`/admin/products/${productId}/variants/${encodeURIComponent(variantId)}`, token, { method: "DELETE" });

// ============================================================
// Colour Groups
// ============================================================

export const getColourGroups = (token: string, productId: number) =>
  adminFetch<ColourGroup[]>(`/admin/products/${productId}/colour-groups`, token);

export const createColourGroup = (token: string, productId: number, data: object) =>
  adminFetch<ColourGroup>(`/admin/products/${productId}/colour-groups`, token, { method: "POST", body: JSON.stringify(data) });

export const updateColourGroup = (token: string, productId: number, groupId: number, data: object) =>
  adminFetch<ColourGroup>(`/admin/products/${productId}/colour-groups/${groupId}`, token, { method: "PUT", body: JSON.stringify(data) });

export const deleteColourGroup = (token: string, productId: number, groupId: number) =>
  adminFetch<{ message: string }>(`/admin/products/${productId}/colour-groups/${groupId}`, token, { method: "DELETE" });

// ============================================================
// Collections
// ============================================================

export const getAdminCollections = (token: string, params?: { page?: number; search?: string }) => {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.search) q.set("search", params.search);
  return adminFetch<PaginatedResponse<AdminCollection>>(`/admin/collections?${q}`, token);
};

export const createAdminCollection = (token: string, data: object) =>
  adminFetch<{ id: number; handle: string; title: string; message: string }>("/admin/collections", token, { method: "POST", body: JSON.stringify(data) });

export const updateAdminCollection = (token: string, id: number, data: object) =>
  adminFetch<{ message: string }>(`/admin/collections/${id}`, token, { method: "PUT", body: JSON.stringify(data) });

export const deleteAdminCollection = (token: string, id: number) =>
  adminFetch<{ message: string }>(`/admin/collections/${id}`, token, { method: "DELETE" });

export const manageCollectionProducts = (token: string, collectionId: number, productIds: number[], action: "attach" | "detach") =>
  adminFetch<{ message: string }>(`/admin/collections/${collectionId}/products`, token, {
    method: "POST",
    body: JSON.stringify({ product_ids: productIds, action }),
  });

// ============================================================
// Orders
// ============================================================

export const getAdminOrders = (token: string, params?: { page?: number; status?: string; search?: string }) => {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  return adminFetch<PaginatedResponse<AdminOrderSummary>>(`/admin/orders?${q}`, token);
};

export const getAdminOrder = (token: string, id: string) =>
  adminFetch<AdminOrder>(`/admin/orders/${id}`, token);

export const updateOrderStatus = (token: string, id: string, data: { status?: string; refund_status?: string; refund_note?: string }) =>
  adminFetch<{ message: string }>(`/admin/orders/${id}/status`, token, { method: "PUT", body: JSON.stringify(data) });

// ============================================================
// Users
// ============================================================

export const getAdminUsers = (token: string, params?: { page?: number; search?: string; role?: string }) => {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.search) q.set("search", params.search);
  if (params?.role !== undefined) q.set("role", params.role);
  return adminFetch<PaginatedResponse<AdminUser>>(`/admin/users?${q}`, token);
};

export const getAdminUser = (token: string, id: number) =>
  adminFetch<AdminUser & { recent_orders: object[] }>(`/admin/users/${id}`, token);

export const suspendUser = (token: string, id: number, reason?: string) =>
  adminFetch<{ message: string }>(`/admin/users/${id}/suspend`, token, { method: "PUT", body: JSON.stringify({ reason }) });

export const reactivateUser = (token: string, id: number) =>
  adminFetch<{ message: string }>(`/admin/users/${id}/reactivate`, token, { method: "PUT" });

export const deleteAdminUser = (token: string, id: number) =>
  adminFetch<{ message: string }>(`/admin/users/${id}`, token, { method: "DELETE" });

// ============================================================
// Reviews
// ============================================================

export const getAdminReviews = (token: string, params?: { page?: number; search?: string; is_hidden?: boolean }) => {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.search) q.set("search", params.search);
  if (params?.is_hidden !== undefined) q.set("is_hidden", String(params.is_hidden));
  return adminFetch<PaginatedResponse<AdminReview>>(`/admin/reviews?${q}`, token);
};

export const getProductReviews = (token: string, productId: number, page = 1) =>
  adminFetch<PaginatedResponse<AdminReview>>(`/admin/products/${productId}/reviews?page=${page}`, token);

export const createAdminReview = (token: string, productId: number, data: object) =>
  adminFetch<AdminReview>(`/admin/products/${productId}/reviews`, token, { method: "POST", body: JSON.stringify(data) });

export const updateAdminReview = (token: string, id: number, data: object) =>
  adminFetch<{ message: string }>(`/admin/reviews/${id}`, token, { method: "PUT", body: JSON.stringify(data) });

export const deleteAdminReview = (token: string, id: number) =>
  adminFetch<{ message: string }>(`/admin/reviews/${id}`, token, { method: "DELETE" });

// ============================================================
// Media Assets
// ============================================================

export const getAdminMedia = (token: string, page = 1) =>
  adminFetch<PaginatedResponse<MediaAsset>>(`/admin/media?page=${page}`, token);

export const confirmMediaAsset = (token: string, data: { url: string; key?: string; size?: number; mime_type?: string; alt_text?: string; provider?: string }) =>
  adminFetch<MediaAsset>("/admin/media/confirm", token, { method: "POST", body: JSON.stringify(data) });

export const deleteMediaAsset = (token: string, id: number) =>
  adminFetch<{ message: string }>(`/admin/media/${id}`, token, { method: "DELETE" });
