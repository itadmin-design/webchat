"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSocket } from "@/components/providers/SocketProvider";
import { MessageData } from "@/types";

export function useMessages(conversationId: string | null) {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);

  // Fetch messages (initial load or refresh)
  const fetchMessages = useCallback(() => {
    if (!conversationId) return;

    fetch(`/api/messages?conversationId=${conversationId}&limit=50`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) {
          setMessages(data.messages);
          setHasMore(data.hasMore);
          if (data.messages.length > 0) {
            cursorRef.current = data.messages[0].createdAt;
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [conversationId]);

  // Fetch on conversationId change
  useEffect(() => {
    if (!conversationId) return;

    setLoading(true);
    setMessages([]);
    cursorRef.current = null;
    fetchMessages();
  }, [conversationId, fetchMessages]);

  // Re-fetch when tab becomes visible (catches messages missed while away)
  useEffect(() => {
    if (!conversationId) return;

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchMessages();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [conversationId, fetchMessages]);

  // Listen for new messages
  useEffect(() => {
    if (!socket || !conversationId) return;

    function handleNewMessage(message: MessageData) {
      if (message.conversationId === conversationId) {
        setMessages((prev) => [...prev, message]);
      }
    }

    socket.on("new_message", handleNewMessage);

    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [socket, conversationId]);

  // Load older messages
  const loadMore = useCallback(async () => {
    if (!conversationId || !hasMore || !cursorRef.current) return;

    const res = await fetch(
      `/api/messages?conversationId=${conversationId}&cursor=${cursorRef.current}&limit=50`
    );
    const data = await res.json();

    if (data.messages && data.messages.length > 0) {
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMore(data.hasMore);
      cursorRef.current = data.messages[0].createdAt;
    } else {
      setHasMore(false);
    }
  }, [conversationId, hasMore]);

  // Send message
  const sendMessage = useCallback(
    (data: {
      content: string;
      messageType?: "text" | "file" | "image";
      attachment?: {
        url: string;
        filename: string;
        mimeType: string;
        size: number;
      };
      replyToMessageId?: string;
    }) => {
      if (!socket || !conversationId) return;

      socket.emit("send_message", {
        conversationId,
        content: data.content,
        messageType: data.messageType || "text",
        attachment: data.attachment,
        replyToMessageId: data.replyToMessageId,
      });
    },
    [socket, conversationId]
  );

  // Mark messages as read
  const markRead = useCallback(() => {
    if (!socket || !conversationId) return;
    socket.emit("mark_read", { conversationId });
  }, [socket, conversationId]);

  return { messages, loading, hasMore, loadMore, sendMessage, markRead };
}
