/**
 * Size Guide API Client
 * Public + Admin CRUD for size guide measurement types.
 */

import { getApiBaseUrl } from "./client";

// ============================================================
// Types
// ============================================================

export interface MeasuringTip {
  title: string;
  description: string;
}

export interface SizeGuideType {
  id: number;
  name: string;
  unit_label: string | null;
  is_visible: boolean;
  display_order: number;
  diagram_image_url: string | null;
  columns: string[];
  rows: Record<string, string>[];
  measuring_tips: MeasuringTip[];
}

export interface SizeGuideTypeCreate {
  name: string;
  unit_label?: string;
  is_visible?: boolean;
  display_order?: number;
  diagram_image_url?: string | null;
  columns: string[];
  rows: Record<string, string>[];
  measuring_tips: MeasuringTip[];
}

export interface SizeGuideTypeUpdate {
  name?: string;
  unit_label?: string | null;
  is_visible?: boolean;
  display_order?: number;
  diagram_image_url?: string | null;
  columns?: string[];
  rows?: Record<string, string>[];
  measuring_tips?: MeasuringTip[];
}

// ============================================================
// Public
// ============================================================

export async function fetchPublicSizeGuide(): Promise<SizeGuideType[]> {
  const res = await fetch(`${getApiBaseUrl()}/size-guide`);
  if (!res.ok) throw new Error("Failed to fetch size guide");
  return res.json();
}

// ============================================================
// Admin
// ============================================================

export async function adminListSizeGuide(token: string): Promise<SizeGuideType[]> {
  const res = await fetch(`${getApiBaseUrl()}/admin/size-guide`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch size guide types");
  return res.json();
}

export async function adminCreateSizeGuideType(
  token: string,
  payload: SizeGuideTypeCreate
): Promise<SizeGuideType> {
  const res = await fetch(`${getApiBaseUrl()}/admin/size-guide`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create size guide type");
  return res.json();
}

export async function adminUpdateSizeGuideType(
  token: string,
  id: number,
  payload: SizeGuideTypeUpdate
): Promise<SizeGuideType> {
  const res = await fetch(`${getApiBaseUrl()}/admin/size-guide/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update size guide type");
  return res.json();
}

export async function adminDeleteSizeGuideType(token: string, id: number): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/admin/size-guide/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete size guide type");
}

export async function adminReorderSizeGuide(
  token: string,
  items: { id: number; display_order: number }[]
): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/admin/size-guide-reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error("Failed to reorder size guide types");
}

