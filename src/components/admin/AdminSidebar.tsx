"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  LayoutDashboard,
  MessagesSquare,
  ClipboardList,
  Users,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useState } from "react";

// Sidebar navigation items
const navItems = [
  { href: "/admin", label: "Панель управления", icon: LayoutDashboard },       // Dashboard
  { href: "/admin/conversations", label: "Диалоги", icon: MessagesSquare },     // Conversations
  { href: "/admin/applications", label: "Заявки", icon: ClipboardList },        // Applications
  { href: "/admin/users", label: "Пользователи", icon: Users },                // Users
];

interface AdminSidebarProps {
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AdminSidebar({ isMobile = false, mobileOpen = false, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Desktop sidebar
  if (!isMobile) {
    return (
      <TooltipProvider delayDuration={300}>
        <div
          className={cn(
            "border-r bg-muted/30 flex flex-col h-full shrink-0 transition-[width] duration-200 ease-out",
            collapsed ? "w-[68px]" : "w-64"
          )}
        >
          {/* Logo */}
          <div className="h-16 flex items-center border-b px-3">
            {collapsed ? (
              <Link href="/admin" className="mx-auto">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-primary-foreground" />
                </div>
              </Link>
            ) : (
              <div className="flex items-center justify-between w-full px-3">
                <Link href="/admin" className="flex items-center gap-2.5">
                  <Image src="/icons/logo.svg" alt="Logo" width={100} height={32} />
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Админ {/* Admin badge */}
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setCollapsed(true)}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1">
            {collapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-9 p-0 mb-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setCollapsed(false)}
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Развернуть</TooltipContent> {/* Expand sidebar */}
              </Tooltip>
            )}

            {navItems.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center justify-center h-9 rounded-lg transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Separator />

          {/* Sign out */}
          <div className="p-3">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-9 p-0 text-muted-foreground"
                    onClick={() => signOut({ callbackUrl: "/" })}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Выйти</TooltipContent> {/* Sign out */}
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Выйти {/* Sign out */}
              </Button>
            )}
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Mobile sidebar (overlay drawer)
  return (
    <AnimatePresence>
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onMobileClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed inset-y-0 left-0 z-50 w-64 bg-background border-r flex flex-col"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Logo + close */}
            <div className="h-16 flex items-center justify-between border-b px-6">
              <Link href="/admin" className="flex items-center gap-2.5" onClick={onMobileClose}>
                <Image src="/icons/logo.svg" alt="Logo" width={100} height={32} />
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  Админ {/* Admin badge */}
                </span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={onMobileClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onMobileClose}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <Separator />

            {/* Sign out */}
            <div className="p-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Выйти {/* Sign out */}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
