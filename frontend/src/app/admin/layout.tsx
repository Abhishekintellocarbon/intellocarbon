import { SuperAdminRoute } from "@/components/auth/super-admin-route";
import { AppHeader } from "@/components/layout/app-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SuperAdminRoute>
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex">
          <AdminSidebar />
          <div className="min-w-0 flex-1">
            <AdminMobileNav />
            {children}
          </div>
        </div>
      </div>
    </SuperAdminRoute>
  );
}
