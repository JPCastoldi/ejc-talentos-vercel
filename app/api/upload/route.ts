import { NextResponse } from "next/server";

// Store the profile image in the same Neon JSONB record as the person.
// This avoids requiring a separate Vercel Blob token for photo uploads.
export async function POST(req: Request) {
  const data = await req.formData();
  const file = data.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Envie uma imagem válida" }, { status: 415 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 5 MB" }, { status: 413 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const url = `data:${file.type};base64,${bytes.toString("base64")}`;
  return NextResponse.json({ url });
}
