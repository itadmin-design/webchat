import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { User } from "@/models/User";
import { Application } from "@/models/Application";
import { auth } from "@/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const conversation = await Conversation.findById(id).lean();
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check access
    if (
      session.user.role !== "admin" &&
      conversation.userId.toString() !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await User.findById(conversation.userId).lean();

    // Fetch the user's application comment (if any)
    let applicationComment = "";
    if (user?.email) {
      const application = await Application.findOne(
        { email: user.email, status: "approved" },
        { comment: 1 }
      ).lean();
      applicationComment = application?.comment || "";
    }

    return NextResponse.json({
      _id: conversation._id.toString(),
      userId: conversation.userId.toString(),
      userName: user?.name || "Unknown",
      userEmail: user?.email || "",
      userCompany: user?.company || "",
      applicationComment,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      lastMessagePreview: conversation.lastMessagePreview,
      unreadByAdmin: conversation.unreadByAdmin,
      unreadByUser: conversation.unreadByUser,
      status: conversation.status,
    });
  } catch (error) {
    console.error("Conversation fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
