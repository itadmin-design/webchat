import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { MagicLink } from "@/models/MagicLink";
import { sendMagicLinkEmail } from "@/lib/resend";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit: 3 requests per email per 15 minutes
    const limit = rateLimit({
      key: `magic-link:${normalizedEmail}`,
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });

    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    await connectDB();

    // Check if user exists and is active
    const user = await User.findOne({ email: normalizedEmail, status: "active" });

    if (!user) {
      console.log(`[magic-link] No active user found for: ${normalizedEmail}`);
      return NextResponse.json({ found: false, message: "No active account found for this email." });
    }

    // Invalidate all previous unused tokens for this email
    await MagicLink.updateMany(
      { email: normalizedEmail, used: false },
      { used: true }
    );

    // Generate token
    const token = crypto.randomBytes(64).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Store in DB with 15-minute expiry
    await MagicLink.create({
      email: normalizedEmail,
      hashedToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    // Send email
    try {
      await sendMagicLinkEmail(normalizedEmail, token);
      console.log(`[magic-link] Email sent to: ${normalizedEmail}`);
    } catch (emailError) {
      console.error(`[magic-link] Failed to send email to ${normalizedEmail}:`, emailError);
      // Still log the magic link URL for development
      const url = `${process.env.NEXT_PUBLIC_APP_URL}/verify?token=${token}`;
      console.log(`[magic-link] DEV fallback link: ${url}`);
    }

    return NextResponse.json({ found: true, message: "Login link sent! Check your inbox." });
  } catch (error) {
    console.error("Magic link send error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
