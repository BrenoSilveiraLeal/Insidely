import net from "node:net";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";

// npm scripts do not automatically load .env files. Shell/CI variables always win.
for (const fileName of [".env.e2e.local", ".env.e2e", ".env.local", ".env"]) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) continue;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2").trim();
    if (value) process.env[match[1]] = value;
  }
}

const clean = (value) => value?.trim().replace(/^(['"])(.*)\1$/, "$2");
const url = clean(process.env.E2E_SUPABASE_URL);
const serviceKey = clean(process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);
const portValue = Number(process.env.PLAYWRIGHT_PORT ?? "3111");
const port = Number.isInteger(portValue) && portValue >= 1024 && portValue <= 65535 ? portValue : 3111;
const failures = [];

if (!serviceKey) failures.push("E2E_SUPABASE_SERVICE_ROLE_KEY não foi definida.");
if (serviceKey?.startsWith("sb_publishable_")) failures.push("Foi informada a publishable key no lugar da service role key.");
if (serviceKey && /^(SUA_CHAVE|your-|replace_|placeholder|changeme)/i.test(serviceKey)) failures.push("E2E_SUPABASE_SERVICE_ROLE_KEY ainda é um placeholder.");
if (!url) failures.push("E2E_SUPABASE_URL não foi definida. Crie .env.e2e.local com a URL HTTPS do projeto de teste.");
if (url && /^[a-z0-9]{20}$/.test(url)) {
  console.log(`[E2E PREFLIGHT] Project Ref detectado; usando https://${url}.supabase.co.`);
} else if (url) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) failures.push("E2E_SUPABASE_URL precisa começar com http:// ou https://.");
  } catch {
    failures.push("E2E_SUPABASE_URL não é uma URL válida.");
  }
}

const occupied = await new Promise((resolve) => {
  const socket = net.createConnection({ host: "127.0.0.1", port });
  socket.once("connect", () => { socket.destroy(); resolve(true); });
  socket.once("error", () => resolve(false));
});
if (occupied) failures.push(`A porta ${port} já está em uso. Feche apenas o servidor de teste dessa porta ou use PLAYWRIGHT_PORT=3112.`);

if (!failures.length && url && serviceKey) {
  const normalizedUrl = /^[a-z0-9]{20}$/.test(url) ? `https://${url}.supabase.co` : url.replace(/\/$/, "");
  try {
    const response = await fetch(`${normalizedUrl}/rest/v1/Company?select=id&limit=1`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!response.ok) {
      const detail = await response.text();
      if (response.status === 401 || response.status === 403) {
        failures.push("A E2E_SUPABASE_SERVICE_ROLE_KEY foi rejeitada pelo Supabase. Confirme que URL e chave pertencem ao mesmo projeto, que a chave foi copiada integralmente e que não foi revogada.");
      } else if (response.status === 404) {
        failures.push("A tabela Company não existe nesse projeto. Aplique as migrations antes de rodar o E2E.");
      } else {
        failures.push(`Supabase respondeu HTTP ${response.status} no health check da tabela Company (${detail.slice(0, 120)}).`);
      }
    }
  } catch {
    failures.push("Não foi possível conectar ao Supabase. Confira E2E_SUPABASE_URL e a rede.");
  }
}

if (failures.length) {
  console.error("[E2E PREFLIGHT] bloqueado:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("[E2E PREFLIGHT] a service role key nunca é exibida nos logs.");
  process.exit(1);
}

console.log(`[E2E PREFLIGHT] OK: Supabase configurado; porta ${port} livre; servidor controlado será iniciado pelo Playwright.`);
