import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectDB();
    const users = await User.find()
      .sort({ createdAt: -1 })
      .lean();

    const formatted = users.map((u) => ({
      _id: u._id.toString(),
      email: u.email,
      name: u.name,
      company: u.company || "",
      role: u.role,
      status: u.status,
      lastLoginAt: u.lastLoginAt?.toISOString() || null,
      createdAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Users list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
