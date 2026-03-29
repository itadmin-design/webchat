export interface ReplyToData {
  messageId: string;
  senderName: string;
  content: string;
  messageType: "text" | "file" | "image" | "system";
  attachmentFilename?: string;
}

export interface MessageData {
  _id: string;
  conversationId: string;
  senderId: string;
  senderRole: "client" | "admin";
  senderName?: string;
  content: string;
  messageType: "text" | "file" | "image" | "system";
  attachment?: {
    url: string;
    filename: string;
    mimeType: string;
    size: number;
  };
  replyTo?: ReplyToData;
  readByAdmin: boolean;
  readByUser: boolean;
  externalMsgId?: number;
  createdAt: string;
}

export interface ConversationData {
  _id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userCompany?: string;
  applicationComment?: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadByAdmin: number;
  unreadByUser: number;
  status: "active" | "archived";
}

export interface ConversationsResponse {
  conversations: ConversationData[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ApplicationData {
  _id: string;
  email: string;
  name: string;
  phone: string;
  comment?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface UserData {
  _id: string;
  email: string;
  name: string;
  company?: string;
  phone?: string;
  role: "client" | "admin";
  status: "pending" | "active" | "suspended";
  lastLoginAt?: string;
  lastLoginIp?: string;
  lastLoginUserAgent?: string;
  lastLoginCountry?: string;
  lastLoginCity?: string;
  adminNotes?: string;
  applicationDate?: string;
  applicationComment?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UtmEventEntry {
  _id: string;
  eventType: "signup" | "visit";
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  url: string;
  createdAt: string;
}

export interface LoginHistoryEntry {
  _id: string;
  ip: string;
  userAgent: string;
  country?: string;
  city?: string;
  loginAt: string;
}
