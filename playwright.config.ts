import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

for (const fileName of [".env.e2e.local", ".env.e2e", ".env.local", ".env"]) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) continue;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

process.env.E2E_MOCK_EXTERNALS ??= "true";
process.env.GOOGLE_MEET_ENABLED ??= "true";
process.env.E2E_TRANSFER_MODE ??= "fail-once";
process.env.CRON_SECRET ??= "e2e-cron-secret";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_e2e_test_secret";
process.env.STRIPE_SECRET_KEY ??= "sk_test_e2e_test_secret";

function cleanUrl(value: string | undefined) {
  const candidate = value?.trim().replace(/^(['"])(.*)\1$/, "$2");
  if (!candidate) return null;
  if (/^[a-z0-9]{20}$/.test(candidate)) return `https://${candidate}.supabase.co`;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString().replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

const e2eSupabaseUrl = cleanUrl(process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL) ?? "https://ifacnetraghfnvbilvhh.supabase.co";
const e2ePublishableKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_MAvcSkUiaOKhJ8BgFDnbHA_GPhX_hZX";
const portValue = Number(process.env.PLAYWRIGHT_PORT ?? "3111");
const port = Number.isInteger(portValue) && portValue >= 1024 && portValue <= 65535 ? portValue : 3111;
const configuredE2EBase = cleanUrl(process.env.E2E_BASE_URL);
const baseURL = configuredE2EBase ?? `http://127.0.0.1:${port}`;
const requiresAuthenticatedFixture = process.argv.some((argument) => argument.includes("authenticated-flow"));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    // A dedicated server prevents stale localhost:3000/3100 processes from affecting E2E.
    command: `${requiresAuthenticatedFixture ? "node scripts/e2e-preflight.mjs && " : ""}node scripts/e2e-server.mjs ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: e2eSupabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: e2ePublishableKey,
      NEXT_PUBLIC_APP_URL: baseURL,
      ...(process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ? { SUPABASE_SERVICE_ROLE_KEY: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY } : {}),
    },
    timeout: 120_000,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});

