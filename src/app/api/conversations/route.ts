import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";
import { User } from "@/models/User";
import { Application } from "@/models/Application";
import { auth } from "@/auth";

const DEFAULT_LIMIT = 20;

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit")) || DEFAULT_LIMIT, 50);

    await connectDB();

    // Build filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filter: any = {};

    if (q.length >= 2) {
      // Search users by name
      const matchingUsers = await User.find(
        { name: { $regex: q, $options: "i" } },
        { _id: 1 }
      ).lean();
      const matchingUserIds = matchingUsers.map((u) => u._id);

      // Search messages by content
      let matchingConvIds: string[] = [];
      try {
        matchingConvIds = await Message.distinct("conversationId", {
          $text: { $search: q },
        });
      } catch {
        // Text index missing — create via native driver and retry
        await Message.collection.createIndex({ content: "text" });
        matchingConvIds = await Message.distinct("conversationId", {
          $text: { $search: q },
        });
      }

      // Combine: conversations where user name matches OR message content matches
      const orConditions = [];
      if (matchingUserIds.length > 0) {
        orConditions.push({ userId: { $in: matchingUserIds } });
      }
      if (matchingConvIds.length > 0) {
        orConditions.push({ _id: { $in: matchingConvIds } });
      }

      if (orConditions.length === 0) {
        // No matches at all
        return NextResponse.json({ conversations: [], hasMore: false, nextCursor: null });
      }

      filter.$or = orConditions;
    }

    // Cursor-based pagination
    if (cursor) {
      filter.lastMessageAt = { $lt: new Date(cursor) };
    }

    const conversations = await Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = conversations.length > limit;
    const page = hasMore ? conversations.slice(0, limit) : conversations;
    const nextCursor = hasMore ? page[page.length - 1].lastMessageAt.toISOString() : null;

    // Get user info for this page
    const userIds = page.map((c) => c.userId);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(
      users.map((u) => [
        u._id.toString(),
        { name: u.name, email: u.email, company: u.company },
      ])
    );

    // Get application comments for these users
    const emails = users.map((u) => u.email).filter(Boolean);
    const applications = await Application.find(
      { email: { $in: emails }, status: "approved" },
      { email: 1, comment: 1 }
    ).lean();
    const appCommentMap = new Map(
      applications.map((a) => [a.email, a.comment || ""])
    );

    const formatted = page.map((c) => {
      const user = userMap.get(c.userId.toString());
      return {
        _id: c._id.toString(),
        userId: c.userId.toString(),
        userName: user?.name || "Unknown",
        userEmail: user?.email || "",
        userCompany: user?.company || "",
        applicationComment: user?.email ? appCommentMap.get(user.email) || "" : "",
        lastMessageAt: c.lastMessageAt.toISOString(),
        lastMessagePreview: c.lastMessagePreview,
        unreadByAdmin: c.unreadByAdmin,
        unreadByUser: c.unreadByUser,
        status: c.status,
      };
    });

    return NextResponse.json({ conversations: formatted, hasMore, nextCursor });
  } catch (error) {
    console.error("Conversations list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
