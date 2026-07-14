import { NextResponse } from "next/server";
import crypto from "crypto";
import { uploadFile } from "@/lib/storage";
import { auth } from "@/auth";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".txt", ".png", ".jpg", ".jpeg",
  ".doc", ".docx", ".xls", ".xlsx",
]);

const MAX_SIZE = 80 * 1024 * 1024; // 80MB

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed. Supported: PDF, TXT, PNG, JPG, DOC, DOCX, XLS, XLSX" },
        { status: 400 }
      );
    }

    // Cross-check file extension against MIME type (prevents spoofed Content-Type)
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: "File extension not allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 80 MB." }, { status: 400 });
    }

    // Use random ID in path to prevent guessable URLs and filename collisions
    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = await uploadFile(`chat-attachments/${id}-${safeName}`, file, file.type, file.name);

    return NextResponse.json({
      url: blob.url,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
