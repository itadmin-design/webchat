"use client";

import { useEffect, useState } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { MessageInput } from "@/components/chat/MessageInput";
import { useMessages } from "@/hooks/useMessages";
import { useSocket } from "@/components/providers/SocketProvider";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ConversationData, MessageData } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Building2, Pin } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";

interface AdminConversationClientProps {
  conversationId: string;
  currentUserId: string;
}

export function AdminConversationClient({
  conversationId,
  currentUserId,
}: AdminConversationClientProps) {
  const { socket } = useSocket();
  const isMobile = useIsMobile();
  const { messages, loading, hasMore, loadMore, sendMessage, markRead } =
    useMessages(conversationId);
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [convLoading, setConvLoading] = useState(true);
  const [userDialogId, setUserDialogId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<MessageData | null>(null);

  // Fetch conversation details
  useEffect(() => {
    fetch(`/api/conversations/${conversationId}`)
      .then((res) => res.json())
      .then((data) => {
        setConversation(data);
        setConvLoading(false);
      })
      .catch(() => setConvLoading(false));
  }, [conversationId]);

  // Join conversation room and mark as read
  useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit("join_conversation", { conversationId });
    markRead();
  }, [socket, conversationId, markRead]);

  // Mark as read on new messages
  useEffect(() => {
    if (messages.length > 0) markRead();
  }, [messages.length, markRead]);

  const handleTypingStart = () => {
    socket?.emit("typing_start", { conversationId });
  };

  const handleTypingStop = () => {
    socket?.emit("typing_stop", { conversationId });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-16 border-b bg-background/80 backdrop-blur-sm flex items-center gap-4 px-6 shrink-0">
        {/* Back button — mobile only (desktop always has the list visible) */}
        {isMobile && (
          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 -ml-2 shrink-0">
            <Link href="/admin/conversations">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        )}

        {convLoading ? (
          <Skeleton className="h-10 w-48" />
        ) : conversation ? (
          <button
            type="button"
            onClick={() => setUserDialogId(conversation.userId)}
            className="flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors hover:bg-muted/50 cursor-pointer"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {conversation.userName?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <h2 className="font-semibold text-sm">{conversation.userName}</h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {conversation.userEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-2.5 w-2.5" />
                    {conversation.userEmail}
                  </span>
                )}
                {conversation.userCompany && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-2.5 w-2.5" />
                    {conversation.userCompany}
                  </span>
                )}
              </div>
            </div>
          </button>
        ) : (
          <span className="text-sm text-muted-foreground">Диалог не найден</span>
        )}
      </div>

      {/* Messages with pinned overlay */}
      <div className="flex-1 min-h-0 relative flex flex-col">
        {/* Pinned application comment */}
        {conversation?.applicationComment && (
          <div className="absolute top-0 left-0 right-0 z-10 border-b bg-background/80 backdrop-blur-sm px-6 py-2.5 flex items-start gap-2.5">
            <Pin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0 rotate-45" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Заявка клиента</p>
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">{conversation.applicationComment}</p>
            </div>
          </div>
        )}

        <ChatWindow
          messages={messages}
          currentUserId={currentUserId}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          className={conversation?.applicationComment ? "pt-16" : undefined}
          onReply={setReplyingTo}
        />
      </div>

      {/* Input */}
      <MessageInput
        conversationId={conversationId}
        onSend={sendMessage}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      <UserDetailDialog
        userId={userDialogId}
        onClose={() => setUserDialogId(null)}
        onUserUpdated={() => {}}
        onUserDeleted={() => setUserDialogId(null)}
      />
    </div>
  );
}
