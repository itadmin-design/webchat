import mongoose, { Schema, Document } from "mongoose";

export interface IAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface IReplyTo {
  messageId: mongoose.Types.ObjectId;
  senderName: string;
  content: string;
  messageType: "text" | "file" | "image" | "system";
  attachmentFilename?: string;
}

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderRole: "client" | "admin";
  content: string;
  messageType: "text" | "file" | "image" | "system";
  attachment?: IAttachment;
  replyTo?: IReplyTo;
  readByAdmin: boolean;
  readByUser: boolean;
  externalMsgId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["client", "admin"], required: true },
    content: { type: String, default: "" },
    messageType: { type: String, enum: ["text", "file", "image", "system"], default: "text" },
    attachment: {
      url: { type: String },
      filename: { type: String },
      mimeType: { type: String },
      size: { type: Number },
    },
    replyTo: {
      messageId: { type: Schema.Types.ObjectId, ref: "Message" },
      senderName: { type: String },
      content: { type: String },
      messageType: { type: String, enum: ["text", "file", "image", "system"] },
      attachmentFilename: { type: String },
    },
    readByAdmin: { type: Boolean, default: false },
    readByUser: { type: Boolean, default: false },
    externalMsgId: { type: Number, default: null },
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ conversationId: 1, readByAdmin: 1 });
MessageSchema.index({ content: "text" });
MessageSchema.index({ externalMsgId: 1 }, { sparse: true });

export const Message = mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
