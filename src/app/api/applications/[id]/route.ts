import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { Application } from "@/models/Application";
import { User } from "@/models/User";
import { Conversation } from "@/models/Conversation";
import { MagicLink } from "@/models/MagicLink";
import { auth } from "@/auth";
import { sendWelcomeEmail } from "@/lib/resend";

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
    const { action } = await request.json();

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await connectDB();
    const application = await Application.findById(id);

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (application.status !== "pending") {
      return NextResponse.json({ error: "Application already processed" }, { status: 400 });
    }

    if (action === "approve") {
      // Create or activate user
      let user = await User.findOne({ email: application.email });

      if (user) {
        user.status = "active";
        user.name = application.name;
        user.phone = application.phone;
        await user.save();
      } else {
        // Create user with a random password (they'll use magic link to login)
        const randomPassword = crypto.randomBytes(32).toString("hex");
        const hashedPassword = await bcrypt.hash(randomPassword, 12);

        user = await User.create({
          email: application.email,
          name: application.name,
          phone: application.phone,
          password: hashedPassword,
          role: "client",
          status: "active",
        });
      }

      // Create conversation for the user
      await Conversation.findOneAndUpdate(
        { userId: user._id },
        { userId: user._id },
        { upsert: true, new: true }
      );

      // Generate magic link for welcome email
      const token = crypto.randomBytes(64).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

      await MagicLink.create({
        email: application.email,
        hashedToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours for welcome
      });

      // Send welcome email
      try {
        await sendWelcomeEmail(application.email, application.name, token);
      } catch (emailErr) {
        console.error("Failed to send welcome email:", emailErr);
      }

      application.status = "approved";
    } else {
      application.status = "rejected";
    }

    application.reviewedBy = session.user.id as unknown as typeof application.reviewedBy;
    application.reviewedAt = new Date();
    await application.save();

    return NextResponse.json({ success: true, application });
  } catch (error) {
    console.error("Application action error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
