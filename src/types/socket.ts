import { MessageData } from "./index";

export interface ClientToServerEvents {
  send_message: (data: {
    conversationId: string;
    content: string;
    messageType: "text" | "file" | "image";
    attachment?: {
      url: string;
      filename: string;
      mimeType: string;
      size: number;
    };
  }) => void;
  mark_read: (data: { conversationId: string }) => void;
  typing_start: (data: { conversationId: string }) => void;
  typing_stop: (data: { conversationId: string }) => void;
  join_conversation: (data: { conversationId: string }) => void;
}

export interface ServerToClientEvents {
  new_message: (message: MessageData) => void;
  message_read: (data: { conversationId: string; readBy: "admin" | "client" }) => void;
  typing: (data: { userId: string; isTyping: boolean }) => void;
  unread_update: (data: { conversationId: string; unreadByUser: number; unreadByAdmin: number }) => void;
  new_conversation: (data: {
    _id: string;
    userId: string;
    userName: string;
    userEmail: string;
    userCompany: string;
    applicationComment: string;
    lastMessageAt: string;
    lastMessagePreview: string;
    unreadByAdmin: number;
    unreadByUser: number;
    status: "active" | "archived";
  }) => void;
}
