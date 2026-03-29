import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { UtmEvent } from "@/models/UtmEvent";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { utmSource, utmMedium, utmCampaign, utmContent, utmTerm, url, eventType } = body;

    if (!utmSource) {
      return NextResponse.json({ error: "utmSource is required" }, { status: 400 });
    }

    await connectDB();

    await UtmEvent.create({
      userId: session.user.id,
      eventType: eventType || "visit",
      utmSource,
      utmMedium: utmMedium || undefined,
      utmCampaign: utmCampaign || undefined,
      utmContent: utmContent || undefined,
      utmTerm: utmTerm || undefined,
      url: url || "",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[UTM Events] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
