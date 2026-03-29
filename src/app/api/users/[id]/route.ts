import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Application } from "@/models/Application";
import { Conversation } from "@/models/Conversation";
import { auth } from "@/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await connectDB();

    const user = await User.findById(id).lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the user's application by email
    const application = await Application.findOne({ email: user.email })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      _id: (user._id as { toString(): string }).toString(),
      email: user.email,
      name: user.name,
      company: user.company || "",
      phone: user.phone || "",
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      lastLoginIp: user.lastLoginIp || null,
      lastLoginUserAgent: user.lastLoginUserAgent || null,
      lastLoginCountry: user.lastLoginCountry || null,
      lastLoginCity: user.lastLoginCity || null,
      adminNotes: user.adminNotes || "",
      applicationDate: application?.createdAt?.toISOString() || null,
      applicationComment: application?.comment || null,
      utmSource: user.utmSource || null,
      utmMedium: user.utmMedium || null,
      utmCampaign: user.utmCampaign || null,
      utmContent: user.utmContent || null,
      utmTerm: user.utmTerm || null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    await connectDB();

    // Whitelist updatable fields
    const allowedFields = ["name", "email", "company", "role", "status", "adminNotes"];
    const update: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        update[key] = body[key];
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Prevent admin from changing their own role
    if (update.role && id === session.user.id) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
    }

    if (update.role && !["client", "admin"].includes(update.role as string)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (update.status && !["pending", "active", "suspended"].includes(update.status as string)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Trim string fields
    if (typeof update.email === "string") update.email = (update.email as string).toLowerCase().trim();
    if (typeof update.name === "string") update.name = (update.name as string).trim();

    const user = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // Handle duplicate email
    if (error && typeof error === "object" && "code" in error && (error as { code: number }).code === 11000) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await connectDB();

    if (id === session.user.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Archive conversation (preserve messages for audit)
    await Conversation.updateOne({ userId: user._id }, { status: "archived" });

    // Delete the user
    await User.findByIdAndDelete(id);

    // Disconnect user's active sockets
    if (global.io) {
      const sockets = await global.io.in(`user:${id}`).fetchSockets();
      for (const s of sockets) {
        s.disconnect(true);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
