import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const startedAt = performance.now();
  const response = await updateSupabaseSession(request);
  const durationMs = Math.round(performance.now() - startedAt);
  response.headers.set("Server-Timing", `supabase_session;dur=${durationMs}`);
  console.info(JSON.stringify({ metric: "route.middleware", route: request.nextUrl.pathname.slice(0, 160), durationMs, status: response.status }));
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
