import type { Instrumentation } from "next";

// Every server error (pages, route handlers, server actions, proxy) becomes one structured line in the
// Vercel runtime logs, searchable by "server.error". Headers and bodies are left out: they carry cookies and personal data.
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const details = error instanceof Error ? { name: error.name, message: error.message.slice(0, 500), digest: (error as Error & { digest?: string }).digest, stack: error.stack?.split("\n").slice(0, 6).join("\n") } : { message: String(error).slice(0, 500) };
  console.error(JSON.stringify({ metric: "server.error", path: request.path.split("?")[0].slice(0, 200), method: request.method, routePath: context.routePath, routeType: context.routeType, ...details }));
};
