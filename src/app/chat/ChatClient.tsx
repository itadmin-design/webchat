"use client";

import { useState, useEffect } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { MessageInput } from "@/components/chat/MessageInput";
import { useMessages } from "@/hooks/useMessages";
import { useSocket } from "@/components/providers/SocketProvider";
import { MessageData } from "@/types";


interface ChatClientProps {
  conversationId: string;
  currentUserId: string;
  user: {
    name: string;
    email: string;
    company?: string;
    phone?: string;
  };
}

export function ChatClient({ conversationId, currentUserId, user }: ChatClientProps) {
  const { socket } = useSocket();
  const { messages, loading, hasMore, loadMore, sendMessage, markRead } =
    useMessages(conversationId);
  const [replyingTo, setReplyingTo] = useState<MessageData | null>(null);

  // Join conversation room and mark messages as read
  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit("join_conversation", { conversationId });
    markRead();
  }, [socket, conversationId, markRead]);

  // Mark as read when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      markRead();
    }
  }, [messages.length, markRead]);

  const handleTypingStart = () => {
    socket?.emit("typing_start", { conversationId });
  };

  const handleTypingStop = () => {
    socket?.emit("typing_stop", { conversationId });
  };

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      <ChatHeader
        title="История Сообщений"
        subtitle={`Вы вошли как ${user.name}`}
        user={user}
      />
      <ChatWindow
        messages={messages}
        currentUserId={currentUserId}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onReply={setReplyingTo}
      />
      <MessageInput
        conversationId={conversationId}
        onSend={sendMessage}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />
    </div>
  );
}
