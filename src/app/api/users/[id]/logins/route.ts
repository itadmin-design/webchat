import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { LoginHistory } from "@/models/LoginHistory";
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

    const entries = await LoginHistory.find({ userId: id })
      .sort({ loginAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json(
      entries.map((e) => ({
        _id: (e._id as { toString(): string }).toString(),
        ip: e.ip,
        userAgent: e.userAgent,
        country: e.country || null,
        city: e.city || null,
        loginAt: e.loginAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Get login history error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
