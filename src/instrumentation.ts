import type { Instrumentation } from "next";

// Every server error (pages, route handlers, server actions, proxy) becomes one structured line in the
// Vercel runtime logs, searchable by "server.error", and a row in ErrorEvent shown on /admin/status.
// Headers and bodies are left out: they carry cookies and personal data.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const details = error instanceof Error ? { name: error.name, message: error.message.slice(0, 500), digest: (error as Error & { digest?: string }).digest, stack: error.stack?.split("\n").slice(0, 6).join("\n") } : { message: String(error).slice(0, 500) };
  const path = request.path.split("?")[0].slice(0, 200);
  console.error(JSON.stringify({ metric: "server.error", path, method: request.method, routePath: context.routePath, routeType: context.routeType, ...details }));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || process.env.NEXT_RUNTIME === "edge") return;
  // Plain REST call: this hook must not import app modules that could themselves fail.
  await fetch(`${url}/rest/v1/ErrorEvent`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ path, routeType: context.routeType, message: details.message, digest: "digest" in details ? details.digest ?? null : null }),
  }).catch(() => undefined);
};
