import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { data, error } = await createSupabaseServiceClient().rpc("release_eligible_bookings_system");
    if (error) return Response.json({ error: "release_failed", detail: error.message }, { status: 500 });
    return Response.json({ ok: true, released: data ?? 0 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "release_failed" }, { status: 500 });
  }
}
