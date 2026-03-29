import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Message } from "@/models/Message";
import { Conversation } from "@/models/Conversation";
import { User } from "@/models/User";
import { auth } from "@/auth";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }

    await connectDB();

    // Verify access
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (
      session.user.role !== "admin" &&
      conversation.userId.toString() !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build query
    const query: Record<string, unknown> = { conversationId };
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = messages.length > limit;
    const result = messages.slice(0, limit).reverse();

    // Get sender names
    const senderIds = [...new Set(result.map((m) => m.senderId.toString()))];
    const users = await User.find({ _id: { $in: senderIds } }).lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u.name]));

    const formatted = result.map((m) => ({
      _id: m._id.toString(),
      conversationId: m.conversationId.toString(),
      senderId: m.senderId.toString(),
      senderRole: m.senderRole,
      senderName: userMap.get(m.senderId.toString()) || "Unknown",
      content: m.content,
      messageType: m.messageType,
      attachment: m.attachment,
      replyTo: m.replyTo?.messageId ? {
        messageId: m.replyTo.messageId.toString(),
        senderName: m.replyTo.senderName,
        content: m.replyTo.content,
        messageType: m.replyTo.messageType,
        attachmentFilename: m.replyTo.attachmentFilename,
      } : undefined,
      readByAdmin: m.readByAdmin,
      readByUser: m.readByUser,
      createdAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json({ messages: formatted, hasMore });
  } catch (error) {
    console.error("Messages fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
