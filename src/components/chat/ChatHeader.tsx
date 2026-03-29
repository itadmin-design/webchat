"use client";

import { useSocket } from "@/components/providers/SocketProvider";
import { MessageSquare } from "lucide-react";
import { ProfileDropdown } from "./ProfileDropdown";

interface ChatHeaderProps {
  title?: string;
  subtitle?: string;
  user: {
    name: string;
    email: string;
    company?: string;
    phone?: string;
  };
}

export function ChatHeader({ title = "Чат поддержки", subtitle, user }: ChatHeaderProps) {
  const { isConnected } = useSocket();

  return (
    <div className="h-16 border-b bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 z-10">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <MessageSquare className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-sm">{title}</h2>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {subtitle || (isConnected ? "Подключено" : "Переподключение...")}
            </span>
          </div>
        </div>
      </div>
      <ProfileDropdown user={user} />
    </div>
  );
}
