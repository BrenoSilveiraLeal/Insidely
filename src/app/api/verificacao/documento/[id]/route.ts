import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Armazenamento não configurado" }, { status: 503 });
  const { id } = await params; const document = await prisma.verificationDocument.findUnique({ where: { id } });
  if (!document) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  const result = await get(document.storageKey, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
  if (!result?.stream) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  return new Response(result.stream, { headers: { "content-type": document.mimeType, "content-disposition": `attachment; filename="${document.originalName.replace(/\"/g, "")}"`, "cache-control": "private, no-store" } });
}
