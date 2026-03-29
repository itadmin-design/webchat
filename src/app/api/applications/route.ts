import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { Application } from "@/models/Application";
import { User } from "@/models/User";
import { Conversation } from "@/models/Conversation";
import { MagicLink } from "@/models/MagicLink";
import { UtmEvent } from "@/models/UtmEvent";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { sendWelcomeEmail } from "@/lib/resend";
import { z } from "zod";

// Flip to false to require manual admin approval
const AUTO_APPROVE = true;

const utmString = z.string().max(200).optional();

const applicationSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(100),
  phone: z.string().min(1, "Phone is required").max(30),
  comment: z.string().max(1000).optional(),
  utm_source: utmString,
  utm_medium: utmString,
  utm_campaign: utmString,
  utm_content: utmString,
  utm_term: utmString,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = applicationSchema.safeParse(body);

    if (!parsed.success) {
      const issues = parsed.error.issues ?? parsed.error;
      const message = Array.isArray(issues) ? issues[0]?.message : "Invalid input";
      return NextResponse.json(
        { error: message || "Invalid input" },
        { status: 400 }
      );
    }

    // Rate limit: 3 per IP per hour
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const limit = rateLimit({ key: `apply:${ip}`, limit: 3, windowMs: 60 * 60 * 1000 });
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many applications. Please try again later." },
        { status: 429 }
      );
    }

    await connectDB();

    const email = parsed.data.email.toLowerCase();

    // Extract UTM params (snake_case from client → camelCase for DB)
    const utmData = {
      ...(parsed.data.utm_source && { utmSource: parsed.data.utm_source }),
      ...(parsed.data.utm_medium && { utmMedium: parsed.data.utm_medium }),
      ...(parsed.data.utm_campaign && { utmCampaign: parsed.data.utm_campaign }),
      ...(parsed.data.utm_content && { utmContent: parsed.data.utm_content }),
      ...(parsed.data.utm_term && { utmTerm: parsed.data.utm_term }),
    };

    // Check if email already has an active application
    const existing = await Application.findOne({
      email,
      status: { $in: ["pending", "approved"] },
    });
    if (existing) {
      return NextResponse.json({
        message: existing.status === "approved"
          ? "Вы уже зарегистрированы."
          : "Ваша заявка уже отправлена.",
        subtitle: existing.status === "approved"
          ? "Войдите через вкладку «По ссылке» или «С паролем»."
          : "Мы скоро свяжемся с вами!",
      });
    }

    const application = await Application.create({
      email,
      name: parsed.data.name,
      phone: parsed.data.phone,
      comment: parsed.data.comment,
      ...utmData,
      status: AUTO_APPROVE ? "approved" : "pending",
      ...(AUTO_APPROVE && { reviewedAt: new Date() }),
    });

    if (AUTO_APPROVE) {
      // Create or activate user account
      let user = await User.findOne({ email });

      if (user) {
        user.set({
          status: "active",
          name: parsed.data.name,
          phone: parsed.data.phone,
          ...utmData,
        });
        await user.save();
      } else {
        const randomPassword = crypto.randomBytes(32).toString("hex");
        const hashedPassword = await bcrypt.hash(randomPassword, 12);

        user = await User.create({
          email,
          name: parsed.data.name,
          phone: parsed.data.phone,
          password: hashedPassword,
          role: "client",
          status: "active",
          ...utmData,
        });
      }

      // Create conversation for the user
      await Conversation.findOneAndUpdate(
        { userId: user._id },
        { userId: user._id },
        { upsert: true, new: true }
      );

      // Record UTM event for signup
      if (utmData.utmSource) {
        await UtmEvent.create({
          userId: user._id,
          eventType: "signup",
          ...utmData,
          url: request.headers.get("referer") || "",
        });
      }

      // Generate magic link token for welcome email
      const token = crypto.randomBytes(64).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

      await MagicLink.create({
        email,
        hashedToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      try {
        await sendWelcomeEmail(email, parsed.data.name, token);
      } catch (emailErr) {
        console.error("Failed to send welcome email:", emailErr);
      }
    }

    return NextResponse.json({
      message: AUTO_APPROVE
        ? "Регистрация завершена!"
        : "Ваша заявка отправлена.",
      subtitle: AUTO_APPROVE
        ? "Мы отправили ссылку для входа на вашу почту."
        : "Мы скоро свяжемся с вами!",
    });
  } catch (error) {
    console.error("Application submit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectDB();
    const applications = await Application.find()
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(applications);
  } catch (error) {
    console.error("Applications list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
