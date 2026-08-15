import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const configuredSecret = process.env.HEALTHCHECK_SECRET;
  if (process.env.NODE_ENV === "production" && (!configuredSecret || request.headers.get("x-healthcheck-secret") !== configuredSecret)) return new Response(null, { status: 404 });
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
