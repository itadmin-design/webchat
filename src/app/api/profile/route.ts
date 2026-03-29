import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(session.user.id).select("+password");
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: user.name,
    email: user.email,
    company: user.company || "",
    phone: user.phone || "",
    hasPassword: !!user.password,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, company, phone, password } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Имя обязательно" }, { status: 400 });
  }

  await connectDB();

  const update: Record<string, unknown> = {
    name: name.trim(),
    company: (company || "").trim(),
    phone: (phone || "").trim(),
  };

  if (password && typeof password === "string") {
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Пароль должен содержать минимум 6 символов" },
        { status: 400 }
      );
    }
    update.password = await bcrypt.hash(password, 12);
  }

  const user = await User.findByIdAndUpdate(session.user.id, update, {
    new: true,
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: user.name,
    email: user.email,
    company: user.company || "",
    phone: user.phone || "",
    hasPassword: !!update.password || true,
  });
}
