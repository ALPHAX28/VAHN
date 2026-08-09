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
  label?: string;
  children?: React.ReactNode;
  variant?: string;
}

export default function AdminBadge({ label, children, variant }: AdminBadgeProps) {
  const text = label || (typeof children === "string" ? children : "");
  const key = variant || text;
  const cls = STATUS_STYLES[key] || STATUS_STYLES[text.toLowerCase()] || "admin-badge--grey";
  return (
    <span className={`admin-badge ${cls}`}>
      {children || label}
    </span>
  );
}

