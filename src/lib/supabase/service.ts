import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Server-only client for trusted jobs. Never import this from client components. */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env vars are missing.");
  return createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
