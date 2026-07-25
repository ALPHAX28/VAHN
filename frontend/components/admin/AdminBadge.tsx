"use client";

const STATUS_STYLES: Record<string, string> = {
  PROCESSING: "admin-badge--amber",
  SHIPPED: "admin-badge--blue",
  DELIVERED: "admin-badge--green",
  CANCELLED: "admin-badge--red",
  PENDING: "admin-badge--amber",
  REFUNDED: "admin-badge--purple",
  active: "admin-badge--green",
  suspended: "admin-badge--red",
  verified: "admin-badge--green",
  unverified: "admin-badge--grey",
  admin: "admin-badge--purple",
  customer: "admin-badge--grey",
  available: "admin-badge--green",
  unavailable: "admin-badge--red",
};

interface AdminBadgeProps {
  label: string;
  variant?: string;
}

export default function AdminBadge({ label, variant }: AdminBadgeProps) {
  const key = variant || label;
  const cls = STATUS_STYLES[key] || "admin-badge--grey";
  return (
    <span className={`admin-badge ${cls}`}>
      {label}
    </span>
  );
}
