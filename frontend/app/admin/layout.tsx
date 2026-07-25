"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AdminAuthProvider, useAdminAuth } from "@/context/AdminAuthContext";
import { UnsavedChangesProvider } from "@/context/UnsavedChangesContext";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar from "@/components/admin/AdminTopbar";

const AUTH_PATHS = ["/admin/login", "/admin/register", "/admin/verify-otp"];

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdminAuthenticated, isAdminLoading } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAuthPage = AUTH_PATHS.some(p => pathname.startsWith(p));

  useEffect(() => {
    if (!isAdminLoading && !isAdminAuthenticated && !isAuthPage) {
      router.push("/admin/login");
    }
  }, [isAdminAuthenticated, isAdminLoading, isAuthPage, router]);

  if (isAdminLoading) {
    return (
      <div className="admin-loading-screen">
        <div className="admin-loading-spinner" />
      </div>
    );
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (!isAdminAuthenticated) return null;

  return (
    <UnsavedChangesProvider>
      <div className="admin-layout">
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="admin-main">
          <AdminTopbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="admin-content">
            {children}
          </main>
        </div>
      </div>
    </UnsavedChangesProvider>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminGuard>
        {children}
      </AdminGuard>
    </AdminAuthProvider>
  );
}
