import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { UtmEvent } from "@/models/UtmEvent";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const events = await UtmEvent.find({ userId: id })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(
      events.map((e) => ({
        _id: e._id.toString(),
        eventType: e.eventType,
        utmSource: e.utmSource,
        utmMedium: e.utmMedium || "",
        utmCampaign: e.utmCampaign || "",
        utmContent: e.utmContent || "",
        utmTerm: e.utmTerm || "",
        url: e.url || "",
        createdAt: e.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("[UTM Events] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
