"use client";

import { useState, useCallback, useEffect, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { AdminSidebar } from "./AdminSidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

const SidebarContext = createContext<(() => void) | null>(null);

export function useOpenSidebar() {
  return useContext(SidebarContext);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);
  const handleOpenSidebar = useCallback(() => setSidebarOpen(true), []);

  return (
    <SidebarContext.Provider value={handleOpenSidebar}>
      <div className="h-dvh flex bg-background">
        {/* Mobile hamburger button — hidden on conversations page (has its own nav) */}
        {isMobile && !sidebarOpen && !pathname.startsWith("/admin/conversations") && (
          <Button
            variant="ghost"
            size="sm"
            className="fixed top-3.5 left-3 z-40 h-9 w-9 p-0 md:hidden"
            onClick={handleOpenSidebar}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {/* Sidebar */}
        <AdminSidebar
          isMobile={isMobile}
          mobileOpen={sidebarOpen}
          onMobileClose={handleCloseSidebar}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0 min-h-0">{children}</main>
      </div>
    </SidebarContext.Provider>
  );
}
