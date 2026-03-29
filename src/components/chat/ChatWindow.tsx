"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageData } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronDown, Loader2 } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import { useSocket } from "@/components/providers/SocketProvider";

interface ChatWindowProps {
  messages: MessageData[];
  currentUserId: string;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  className?: string;
  onReply?: (message: MessageData) => void;
}

function DateSeparator({ date }: { date: string }) {
  const d = new Date(date);
  let label: string;
  if (isToday(d)) label = "Сегодня"; // Today
  else if (isYesterday(d)) label = "Вчера"; // Yesterday
  else label = format(d, "d MMMM yyyy", { locale: ru });

  return (
    <div className="flex items-center justify-center my-4">
      <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
        {label}
      </span>
    </div>
  );
}

export function ChatWindow({
  messages,
  currentUserId,
  loading,
  hasMore,
  onLoadMore,
  className,
  onReply,
}: ChatWindowProps) {
  const { socket } = useSocket();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Auto scroll to bottom on new messages (only when already at bottom)
  useEffect(() => {
    if (isAtBottomRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Initial scroll to bottom (wait for layout to finish)
  useEffect(() => {
    if (!loading && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [loading]);

  // Track scroll position
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    isAtBottomRef.current = atBottom;
    setShowScrollButton(!atBottom);
  };

  // Listen for typing events
  useEffect(() => {
    if (!socket) return;

    function handleTyping(data: { userId: string; isTyping: boolean }) {
      if (data.userId !== currentUserId) {
        setTypingUser(data.isTyping ? data.userId : null);
      }
    }

    socket.on("typing", handleTyping);
    return () => { socket.off("typing", handleTyping); };
  }, [socket, currentUserId]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const container = scrollRef.current;
    const prevHeight = container?.scrollHeight || 0;

    await onLoadMore();

    // Restore scroll position after loading older messages
    requestAnimationFrame(() => {
      if (container) {
        container.scrollTop = container.scrollHeight - prevHeight;
      }
      setLoadingMore(false);
    });
  };

  // Scroll to a specific message (for reply click)
  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-primary/10", "rounded-lg");
      setTimeout(() => el.classList.remove("bg-primary/10", "rounded-lg"), 1500);
    }
  }, []);

  // Group messages by date
  let lastDate = "";

  if (loading) {
    return (
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
            <Skeleton className={`h-12 ${i % 2 === 0 ? "w-48" : "w-56"} rounded-2xl`} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`absolute inset-0 overflow-y-auto overflow-x-hidden px-4 py-3 ${className || ""}`}
      >
        {/* Load more button */}
        {hasMore && (
          <div className="text-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="text-xs text-muted-foreground"
            >
              {loadingMore ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Загрузить ранние сообщения {/* Load older messages */}
            </Button>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center min-h-[200px]">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Сообщений пока нет</p> {/* No messages yet */}
              <p className="text-xs text-muted-foreground/60 mt-1">
                Отправьте сообщение, чтобы начать разговор {/* Send a message to start the conversation */}
              </p>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => {
          const msgDate = format(new Date(msg.createdAt), "yyyy-MM-dd");
          const showDate = msgDate !== lastDate;
          lastDate = msgDate;

          return (
            <div key={msg._id}>
              {showDate && <DateSeparator date={msg.createdAt} />}
              <MessageBubble
                message={msg}
                isOwn={msg.senderId === currentUserId}
                onReply={onReply}
                onScrollToMessage={scrollToMessage}
              />
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingUser && <TypingIndicator />}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button — outside scroll container */}
      {showScrollButton && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-4 right-4 rounded-full h-9 w-9 p-0 z-10 cursor-pointer"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
