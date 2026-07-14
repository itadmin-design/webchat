import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || "auto",
  endpoint: process.env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

export const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME!;

export async function uploadFile(
  key: string,
  body: File | Blob | ReadableStream | Buffer,
  contentType?: string,
  originalName?: string,
): Promise<{ url: string }> {
  let buffer: Buffer;

  if (Buffer.isBuffer(body)) {
    buffer = body;
  } else if (body instanceof Blob) {
    buffer = Buffer.from(await body.arrayBuffer());
  } else {
    // ReadableStream
    const chunks: Uint8Array[] = [];
    const reader = (body as ReadableStream).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    buffer = Buffer.concat(chunks);
  }

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType || "application/octet-stream",
    // Оригинальное имя (с кириллицей) храним в метаданных S3 в percent-encoded виде
    Metadata: originalName ? { originalname: encodeURIComponent(originalName) } : undefined,
  }));

  return { url: `/api/files/${key}` };
}

export async function getFile(key: string) {
  const response = await s3.send(new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  }));
  return response;
}
