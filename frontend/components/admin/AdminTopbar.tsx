"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useUnsavedChanges } from "@/context/UnsavedChangesContext";

import Image from "next/image";

const BREADCRUMB_MAP: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/dashboard": "Dashboard",
  "/admin/products": "Products",
  "/products": "Products",
  "/admin/products/new": "New Product",
  "/products/new": "New Product",
  "/admin/collections": "Collections",
  "/collections": "Collections",
  "/admin/orders": "Orders",
  "/orders": "Orders",
  "/admin/users": "Customers",
  "/users": "Customers",
  "/admin/reviews": "Reviews",
  "/reviews": "Reviews",
  "/admin/announcements": "Banners & Alerts",
  "/announcements": "Banners & Alerts",
  "/admin/size-guide": "Size Guide",
  "/size-guide": "Size Guide",
};

function getBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const isDirectSubpath = !pathname.startsWith('/admin');
  const baseHref = isDirectSubpath ? "/dashboard" : "/admin/dashboard";
  const crumbs: { label: string; href: string }[] = [{ label: "Admin", href: baseHref }];
  const parts = pathname.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    if (current === "/admin" || current === "/admin/dashboard" || current === "/dashboard") continue;
    const label = BREADCRUMB_MAP[current] || (part.match(/^\d+$/) ? `#${part}` : part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " "));
    crumbs.push({ label, href: current });
  }
  return crumbs;
}

interface AdminTopbarProps {
  onMenuClick: () => void;
}

export default function AdminTopbar({ onMenuClick }: AdminTopbarProps) {
  const pathname = usePathname();
  const { adminUser, adminLogout } = useAdminAuth();
  const { confirmNavigation } = useUnsavedChanges();
  const breadcrumbs = getBreadcrumbs(pathname);

  function handleBreadcrumbClick(e: React.MouseEvent, href: string) {
    if (!confirmNavigation(href)) {
      e.preventDefault();
    }
  }

  return (
    <header className="admin-topbar">
      <div className="admin-topbar-left">
        {/* Hamburger (mobile) */}
        <button
          className="admin-topbar-menu-btn"
          onClick={onMenuClick}
          aria-label="Open sidebar menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        {/* Breadcrumb */}
        <nav className="admin-topbar-breadcrumb" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={`${crumb.href}-${i}`} className="admin-breadcrumb-item">
              {i > 0 && <span className="admin-breadcrumb-sep">/</span>}
              {i < breadcrumbs.length - 1 ? (
                <Link href={crumb.href} className="admin-breadcrumb-link" onClick={e => handleBreadcrumbClick(e, crumb.href)}>{crumb.label}</Link>
              ) : (
                <span className="admin-breadcrumb-current">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="admin-topbar-right">
        {/* View Storefront */}
        <Link href="/" target="_blank" className="admin-topbar-storefront-btn" title="View storefront">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          <span className="admin-topbar-storefront-label">Storefront</span>
        </Link>

        {/* Admin avatar */}
        <div className="admin-topbar-avatar" title={`Signed in as ${adminUser?.email}`}>
          <span>{adminUser?.full_name?.charAt(0).toUpperCase() || "A"}</span>
        </div>

        {/* Logout */}
        <button className="admin-topbar-logout-btn" onClick={adminLogout} title="Sign out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
