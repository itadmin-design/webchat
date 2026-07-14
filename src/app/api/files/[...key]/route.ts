import { NextResponse } from "next/server";
import { getFile } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await params;
    const fileKey = key.join("/");

    const response = await getFile(fileKey);

    if (!response.Body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stream = response.Body as ReadableStream;
    const headers = new Headers();
    if (response.ContentType) headers.set("Content-Type", response.ContentType);
    if (response.ContentLength) headers.set("Content-Length", String(response.ContentLength));
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    // Отдаём оригинальное имя файла (в т.ч. с кириллицей) через RFC 5987
    const metaName = (response.Metadata as Record<string, string> | undefined)?.originalname;
    if (metaName) {
      let original = metaName;
      try { original = decodeURIComponent(metaName); } catch {}
      const asciiFallback = original.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
      headers.set(
        "Content-Disposition",
        `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(original)}`
      );
    }

    return new Response(stream as unknown as BodyInit, { headers });
  } catch (error: unknown) {
    const code = (error as { name?: string })?.name;
    if (code === "NoSuchKey") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    console.error("File proxy error:", error);
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}
