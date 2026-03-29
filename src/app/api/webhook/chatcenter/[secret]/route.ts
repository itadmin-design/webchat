import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";
import { uploadFile } from "@/lib/storage";
import { sendPushNotification } from "@/lib/push";

const OUTGOING_SECRET = process.env.CHATCENTER_OUTGOING_SECRET || "";
const SYSTEM_USER_ID = process.env.CHATCENTER_SYSTEM_USER_ID || "";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ secret: string }> }
) {
  try {
    const { secret } = await params;

    console.log("[ChatCenter Inbound] Received webhook request");

    // Validate URL secret
    if (!OUTGOING_SECRET || secret !== OUTGOING_SECRET) {
      console.warn("[ChatCenter Inbound] Invalid URL secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();

    // Log all received fields for debugging
    const fields: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        fields[key] = `[File: ${value.name}, ${value.type}, ${value.size} bytes]`;
      } else {
        fields[key] = key === "secret" ? "***" : String(value);
      }
    }
    console.log("[ChatCenter Inbound] Fields:", JSON.stringify(fields));

    // Also validate body secret (recommended by their docs)
    const bodySecret = formData.get("secret") as string;
    if (bodySecret !== OUTGOING_SECRET) {
      console.warn("[ChatCenter Inbound] Invalid body secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const type = formData.get("type") as string; // "text" | "file"
    const text = (formData.get("text") as string) || "";
    const msgId = Number(formData.get("msgId")) || 0;
    const chatId = Number(formData.get("chatId")) || 0;
    const replayToMsgId = Number(formData.get("replayToMsgId")) || 0;
    const fileName = formData.get("fileName") as string | null;
    const file = formData.get("file") as File | null;

    if (!chatId) {
      console.warn("[ChatCenter Inbound] Missing chatId, skipping");
      return new Response("OK", { status: 200 });
    }

    await connectDB();

    // Deduplicate by externalMsgId
    if (msgId) {
      const existing = await Message.findOne({ externalMsgId: msgId });
      if (existing) {
        console.log(`[ChatCenter Inbound] Duplicate msgId=${msgId}, skipping`);
        return new Response("OK", { status: 200 });
      }
    }

    // Find conversation by externalChatId
    const conversation = await Conversation.findOne({ externalChatId: chatId });
    if (!conversation) {
      console.warn(`[ChatCenter Inbound] No conversation for chatId=${chatId}, skipping`);
      return new Response("OK", { status: 200 });
    }

    // Handle file upload to S3
    let attachment: { url: string; filename: string; mimeType: string; size: number } | undefined;
    if (type === "file" && file) {
      const id = crypto.randomUUID();
      const safeName = (fileName || file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const blob = await uploadFile(`chat-attachments/${id}-${safeName}`, file, file.type || "application/octet-stream");
      attachment = {
        url: blob.url,
        filename: fileName || file.name || "file",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      };
    }

    const messageType = type === "file" && attachment ? "file" : "text";

    // Build replyTo if operator replied to a specific message
    let replyTo: {
      messageId: typeof conversation._id;
      senderName: string;
      content: string;
      messageType: string;
      attachmentFilename?: string;
    } | undefined;

    if (replayToMsgId) {
      console.log(`[ChatCenter Inbound] replayToMsgId=${replayToMsgId}, looking up original message`);
      const originalMsg = await Message.findOne({ externalMsgId: replayToMsgId });
      if (originalMsg) {
        const isAdmin = originalMsg.senderRole === "admin";
        replyTo = {
          messageId: originalMsg._id,
          senderName: isAdmin ? "Оператор" : (conversation.userName || "Клиент"),
          content: (originalMsg.content || "").substring(0, 100),
          messageType: originalMsg.messageType,
          attachmentFilename: originalMsg.attachment?.filename,
        };
        console.log(`[ChatCenter Inbound] Built replyTo: originalId=${originalMsg._id}, sender=${replyTo.senderName}, type=${replyTo.messageType}`);
      } else {
        console.warn(`[ChatCenter Inbound] Original message not found for externalMsgId=${replayToMsgId}`);
      }
    }

    // Create message from the external operator
    const message = await Message.create({
      conversationId: conversation._id,
      senderId: SYSTEM_USER_ID,
      senderRole: "admin",
      content: text,
      messageType,
      attachment,
      readByAdmin: true,
      readByUser: false,
      externalMsgId: msgId || null,
      replyTo,
    });

    // Update conversation metadata
    const preview = (text || "").substring(0, 100) || (attachment ? attachment.filename : "");
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessageAt: new Date(),
      lastMessagePreview: preview,
      $inc: { unreadByUser: 1 },
    });

    // Emit via Socket.io if available
    const io = global.io;
    if (io) {
      const messageData = {
        _id: message._id.toString(),
        conversationId: conversation._id.toString(),
        senderId: SYSTEM_USER_ID,
        senderRole: "admin",
        senderName: "Оператор",
        content: message.content,
        messageType: message.messageType,
        attachment: message.attachment,
        readByAdmin: true,
        readByUser: false,
        createdAt: message.createdAt.toISOString(),
        replyTo: replyTo ? {
          messageId: replyTo.messageId.toString(),
          senderName: replyTo.senderName,
          content: replyTo.content,
          messageType: replyTo.messageType,
          attachmentFilename: replyTo.attachmentFilename,
        } : undefined,
      };

      io.to(`conversation:${conversation._id}`).emit("new_message", messageData);
      io.to(`user:${conversation.userId}`).emit("unread_update", {
        conversationId: conversation._id.toString(),
        unreadByAdmin: conversation.unreadByAdmin || 0,
        unreadByUser: (conversation.unreadByUser || 0) + 1,
      });
    }

    // Push notification to the client
    sendPushNotification(conversation.userId.toString(), {
      title: "Новое сообщение от оператора",
      body: preview || "Новое сообщение",
      url: "/chat",
      tag: `chat-${conversation._id}`,
    }).catch(console.error);

    console.log(`[ChatCenter Inbound] Message created: ${message._id}, type=${messageType}, chatId=${chatId}, msgId=${msgId}`);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[ChatCenter Inbound] Error:", error);
    return new Response("OK", { status: 200 }); // Return 200 to prevent retries
  }
}
