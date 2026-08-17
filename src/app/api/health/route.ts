import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.json({ ok: false, app: "ok", database: "not_configured" }, { status: 503 });
  }
  try {
    const { data, error } = await createSupabasePublicClient().rpc("health_check");
    const ok = !error && Boolean(data && typeof data === "object" && "ok" in data && data.ok);
    return NextResponse.json({ ok, app: "ok", database: ok ? "ok" : "unavailable" }, { status: ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ ok: false, app: "ok", database: "unavailable" }, { status: 503 });
  }
}
