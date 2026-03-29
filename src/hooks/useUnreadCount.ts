"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/components/providers/SocketProvider";

export function useUnreadCount() {
  const { socket } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!socket) return;

    function handleUnreadUpdate(data: {
      unreadByUser: number;
      unreadByAdmin: number;
    }) {
      // This will be overridden based on role in components
      setUnreadCount((prev) => prev + 1);
    }

    socket.on("unread_update", handleUnreadUpdate);

    return () => {
      socket.off("unread_update", handleUnreadUpdate);
    };
  }, [socket]);

  // Update document title with unread count
  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) BENEFITSAR`;
    } else {
      document.title = "BENEFITSAR";
    }
  }, [unreadCount]);

  return { unreadCount, setUnreadCount };
}
