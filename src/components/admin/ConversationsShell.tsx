"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSocket } from "@/components/providers/SocketProvider";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ConversationData, ConversationsResponse } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2, Menu } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { useOpenSidebar } from "@/components/admin/AdminShell";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

interface ConversationsShellProps {
  children: React.ReactNode;
}

export function ConversationsShell({ children }: ConversationsShellProps) {
  const { socket } = useSocket();
  const isMobile = useIsMobile();
  const openSidebar = useOpenSidebar();
  const pathname = usePathname();
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Derive selected conversation ID from the URL pathname
  const selectedId = pathname.startsWith("/admin/conversations/")
    ? pathname.split("/")[3] || null
    : null;

  const isOnDetailRoute = !!selectedId;

  // Fetch conversations (initial or search)
  const fetchConversations = useCallback(async (query: string, cursor?: string) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (query.trim().length >= 2) params.set("q", query.trim());
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`/api/conversations?${params}`);
    if (!res.ok) throw new Error("Failed to fetch conversations");
    const data: ConversationsResponse = await res.json();
    return data;
  }, []);

  // Initial load
  useEffect(() => {
    fetchConversations("")
      .then((data) => {
        setConversations(data.conversations);
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
        setInitialLoading(false);
      })
      .catch(() => setInitialLoading(false));
  }, [fetchConversations]);

  // Re-fetch when tab becomes visible (catches conversations missed while away)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchConversations(searchQuery).then((data) => {
          setConversations(data.conversations);
          setHasMore(data.hasMore);
          setNextCursor(data.nextCursor);
        }).catch(() => {});
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchConversations, searchQuery]);

  // Search handler (debounced)
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await fetchConversations(value);
        setConversations(data.conversations);
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
      } catch {
        setConversations([]);
        setHasMore(false);
        setNextCursor(null);
      }
      setSearching(false);
    }, 300);
  }, [fetchConversations]);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await fetchConversations(searchQuery, nextCursor);
      setConversations((prev) => [...prev, ...data.conversations]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch {
      // ignore
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, nextCursor, searchQuery, fetchConversations]);

  // Infinite scroll via IntersectionObserver on sentinel element
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  // Real-time unread updates
  useEffect(() => {
    if (!socket) return;

    function handleUnreadUpdate(data: {
      conversationId: string;
      unreadByAdmin: number;
    }) {
      setConversations((prev) =>
        prev.map((c) =>
          c._id === data.conversationId
            ? { ...c, unreadByAdmin: data.unreadByAdmin }
            : c
        )
      );
    }

    socket.on("unread_update", handleUnreadUpdate);
    return () => {
      socket.off("unread_update", handleUnreadUpdate);
    };
  }, [socket]);

  // Add new conversations to the list in real-time
  useEffect(() => {
    if (!socket) return;

    function handleNewConversation(conv: ConversationData) {
      setConversations((prev) => {
        // Skip if already in the list
        if (prev.some((c) => c._id === conv._id)) return prev;
        return [conv, ...prev];
      });
    }

    socket.on("new_conversation", handleNewConversation);
    return () => {
      socket.off("new_conversation", handleNewConversation);
    };
  }, [socket]);

  // Update conversation list preview on new messages
  useEffect(() => {
    if (!socket) return;

    function handleNewMessage(message: { conversationId: string; content: string; createdAt: string }) {
      setConversations((prev) =>
        prev.map((c) =>
          c._id === message.conversationId
            ? { ...c, lastMessagePreview: message.content, lastMessageAt: message.createdAt }
            : c
        ).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
      );
    }

    socket.on("new_message", handleNewMessage);
    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [socket]);

  const handleSelectConversation = useCallback((id: string) => {
    router.push(`/admin/conversations/${id}`);
  }, [router]);

  // Helper for pluralizing conversation count
  function conversationCountLabel(count: number) {
    if (count === 1) return "диалог";
    if (count >= 2 && count <= 4) return "диалога";
    return "диалогов";
  }

  // On mobile: show list when on index, show chat when on detail
  const showList = !isMobile || !isOnDetailRoute;
  const showChat = !isMobile || isOnDetailRoute;

  return (
    <div className="h-dvh flex overflow-hidden">
      {/* Left panel: conversation list */}
      {showList && (
        <div className={cn("border-r flex flex-col shrink-0", isMobile ? "w-full" : "w-[320px]")}>
          <div className="h-16 border-b flex items-center gap-3 px-6 shrink-0">
            {isMobile && openSidebar && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 -ml-2 shrink-0"
                onClick={openSidebar}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-lg font-semibold">Диалоги</h1>
              <p className="text-xs text-muted-foreground">
                {conversations.length} {conversationCountLabel(conversations.length)}
                {hasMore ? "+" : ""}
              </p>
            </div>
          </div>

          <div className="px-3 py-3 shrink-0">
            <div className="relative">
              {searching ? (
                <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
              ) : (
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              )}
              <Input
                placeholder="Поиск переписок"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-10 pl-9 pr-8 text-sm rounded-full border-none shadow-none bg-muted-foreground/5"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className={`py-0 transition-opacity duration-150 ${searching ? "opacity-50" : "opacity-100"}`}>
              {initialLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="h-12 animate-pulse bg-muted rounded" />
                  </div>
                ))
              ) : conversations.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {searchQuery.trim() ? "Совпадений не найдено" : "Диалогов пока нет"}
                </div>
              ) : (
                <>
                  {conversations.map((conv) => (
                    <button
                      key={conv._id}
                      type="button"
                      onClick={() => handleSelectConversation(conv._id)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-muted/50 ${
                        selectedId === conv._id ? "bg-muted" : ""
                      }`}
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                          {conv.userName?.charAt(0).toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">{conv.userName}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true, locale: ru })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.lastMessagePreview || "Сообщений пока нет"}
                          </p>
                          {conv.unreadByAdmin > 0 && (
                            <Badge className="h-4 min-w-[16px] flex items-center justify-center text-[9px] px-1 shrink-0">
                              {conv.unreadByAdmin}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  {loadingMore && (
                    <div className="flex justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {hasMore && <div ref={sentinelRef} className="h-1" />}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Right panel: page content (empty state or chat) */}
      {showChat && (
        <div className="flex-1 flex flex-col min-w-0">
          {children}
        </div>
      )}
    </div>
  );
}
