import "server-only";

type MetricValue = string | number | boolean | null;

function safeRoute(value?: string) {
  return value?.replace(/[\r\n]/g, "").slice(0, 160) || "unknown";
}

export function recordMetric(name: string, values: Record<string, MetricValue>) {
  // Structured logs are consumed by Vercel Logs/Drains without exposing payloads.
  console.info(JSON.stringify({ metric: name, ...values }));
}

export async function measureRpc<T>(rpc: string, run: () => Promise<{ data: T; error: { message: string } | null }>, route?: string) {
  const startedAt = performance.now();
  try {
    const result = await run();
    const serialized = result.data == null ? "" : JSON.stringify(result.data);
    recordMetric("supabase.rpc", { rpc: safeRoute(rpc), route: safeRoute(route), durationMs: Math.round(performance.now() - startedAt), jsonBytes: Buffer.byteLength(serialized, "utf8"), error: result.error?.message ?? null });
    return result;
  } catch (error) {
    recordMetric("supabase.rpc", { rpc: safeRoute(rpc), route: safeRoute(route), durationMs: Math.round(performance.now() - startedAt), jsonBytes: 0, error: error instanceof Error ? error.message : "unknown" });
    throw error;
  }
}
