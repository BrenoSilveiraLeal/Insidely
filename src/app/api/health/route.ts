import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function GET() { const supabase = await createSupabaseServerClient(); const { error } = await supabase.from("User").select("id", { head: true, count: "exact" }); return NextResponse.json({ ok: !error, backend: "supabase", error: error?.message ?? null }, { status: error ? 503 : 200 }); }
