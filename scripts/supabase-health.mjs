import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

for (const path of [".env.local", ".env"]) {
  if (existsSync(path)) loadEnvFile(path);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Supabase health check: configuração ausente.");
  process.exit(1);
}
try {
  const response = await fetch(`${url}/rest/v1/rpc/health_check`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  if (!result?.ok) throw new Error("resposta inválida");
  console.log("Supabase Database e Data API acessíveis.");
} catch (error) {
  console.error("Supabase health check falhou:", error instanceof Error ? error.message : "erro desconhecido");
  process.exit(1);
}
