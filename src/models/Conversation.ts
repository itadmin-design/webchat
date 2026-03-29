import mongoose, { Schema, Document } from "mongoose";

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  lastMessageAt: Date;
  lastMessagePreview: string;
  unreadByAdmin: number;
  unreadByUser: number;
  status: "active" | "archived";
  externalChatId: number | null;
  externalCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: "" },
    unreadByAdmin: { type: Number, default: 0 },
    unreadByUser: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    externalChatId: { type: Number, default: null },
    externalCode: { type: String, default: null },
  },
  { timestamps: true }
);

// userId index already created by `unique: true`
ConversationSchema.index({ lastMessageAt: -1 });
ConversationSchema.index({ externalChatId: 1 }, { sparse: true });

export const Conversation =
  mongoose.models.Conversation || mongoose.model<IConversation>("Conversation", ConversationSchema);
