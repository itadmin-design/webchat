import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { MagicLink } from "@/models/MagicLink";
import { User } from "@/models/User";
import { SignJWT } from "jose";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    await connectDB();
    const magicLink = await MagicLink.findOne({ hashedToken });

    if (!magicLink) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }

    if (magicLink.used) {
      return NextResponse.json({ error: "This link has already been used" }, { status: 400 });
    }

    if (magicLink.expiresAt < new Date()) {
      return NextResponse.json({ error: "This link has expired" }, { status: 400 });
    }

    // Mark as used
    magicLink.used = true;
    await magicLink.save();

    // Find the user
    const user = await User.findOne({ email: magicLink.email, status: "active" });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Create a JWT session token for Auth.js
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
    const sessionToken = await new SignJWT({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      sub: user._id.toString(),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    return NextResponse.json({
      success: true,
      sessionToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Magic link verify error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
