import { createClient } from "@supabase/supabase-js";

const clean = (value: string | undefined) => value?.trim().replace(/^(['"])(.*)\1$/, "$2");
const rawUrl = clean(process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
const url = rawUrl && /^[a-z0-9]{20}$/.test(rawUrl) ? `https://${rawUrl}.supabase.co` : rawUrl;
const serviceRoleKey = clean(process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);

export function getSupabaseAdmin() {
  if (!url || !/^https:\/\//.test(url)) throw new Error("E2E_SUPABASE_URL inválida. Use a URL HTTPS do projeto de teste.");
  if (!serviceRoleKey) throw new Error("E2E_SUPABASE_SERVICE_ROLE_KEY não configurada. Crie o arquivo .env.e2e.");
  if (serviceRoleKey.startsWith("sb_publishable_") || /^(SUA_CHAVE|your-|replace_|placeholder|changeme)/i.test(serviceRoleKey)) {
    throw new Error("E2E_SUPABASE_SERVICE_ROLE_KEY não é uma chave server-side válida.");
  }
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
