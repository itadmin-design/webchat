"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "next-auth/react";
import { User, LogOut, Pencil, Building2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditProfileDialog } from "./EditProfileDialog";

interface ProfileDropdownProps {
  user: {
    name: string;
    email: string;
    company?: string;
    phone?: string;
  };
}

export function ProfileDropdown({ user }: ProfileDropdownProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userData, setUserData] = useState(user);

  return (
    <>
      {menuOpen && createPortal(
        <div className="fixed inset-0 z-40 bg-white/10 backdrop-blur-sm" />,
        document.body
      )}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <User className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="px-3 py-2.5">
            <p className="font-medium text-sm">{userData.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{userData.email}</p>
            {userData.company && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{userData.company}</span>
              </div>
            )}
            {userData.phone && (
              <div className="flex items-center gap-1.5 mt-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{userData.phone}</span>
              </div>
            )}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Редактировать профиль
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
            <LogOut className="h-4 w-4 mr-2" />
            Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={(updated) => {
          setUserData((prev) => ({ ...prev, ...updated }));
        }}
      />
    </>
  );
}
