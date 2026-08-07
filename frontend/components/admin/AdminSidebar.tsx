"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useUnsavedChanges } from "@/context/UnsavedChangesContext";
import Image from "next/image";

const NAV_ITEMS = [
  {
    section: "Overview",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
    ]
  },
  {
    section: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
      { href: "/admin/collections", label: "Collections", icon: "M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10" },
    ]
  },
  {
    section: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" },
      { href: "/admin/users", label: "Customers", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
    ]
  },
  {
    section: "Content",
    items: [
      { href: "/admin/reviews", label: "Reviews", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
      { href: "/admin/size-guide", label: "Size Guide", icon: "M9 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3M9 7V5a2 2 0 0 1 2-2h6l4 4v6a2 2 0 0 1-2 2h-2M9 7h6m-6 4h4m-4 4h2" },
    ]
  },
];

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { adminUser, adminLogout } = useAdminAuth();
  const { confirmNavigation } = useUnsavedChanges();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const isActive = (href: string) =>
    href === "/admin/dashboard" ? pathname === href : pathname.startsWith(href);

  function handleNavClick(e: React.MouseEvent, href: string) {
    if (!confirmNavigation(href)) {
      e.preventDefault();
      return;
    }
    onClose();
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="admin-sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`admin-sidebar ${isOpen ? "admin-sidebar--open" : ""}`}>
        {/* Logo */}
        <div className="admin-sidebar-logo">
          <Link
            href="/admin/dashboard"
            onClick={(e) => handleNavClick(e, "/admin/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <Image src="/assets/logo-white.png" alt="VAHN" width={80} height={20} style={{ objectFit: "contain", height: "auto" }} />
            <span className="admin-sidebar-logo-badge">ADMIN</span>
          </Link>
          <button className="admin-sidebar-close-btn" onClick={onClose} aria-label="Close sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="admin-sidebar-nav">
          {NAV_ITEMS.map(section => (
            <div key={section.section} className="admin-nav-section">
              <span className="admin-nav-section-label">{section.section}</span>
              {section.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-nav-item ${isActive(item.href) ? "admin-nav-item--active" : ""}`}
                  onClick={(e) => handleNavClick(e, item.href)}
                >
                  <svg
                    className="admin-nav-icon"
                    width="18" height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer: Admin profile + logout */}
        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-avatar">
              {adminUser?.full_name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="admin-sidebar-user-info">
              <span className="admin-sidebar-user-name">{adminUser?.full_name || "Admin"}</span>
              <span className="admin-sidebar-user-role">Administrator</span>
            </div>
          </div>
          <button className="admin-sidebar-logout" onClick={adminLogout} title="Sign out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
