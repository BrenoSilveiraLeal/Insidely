import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Profile photos and covers are checked before upload with OpenAI's free moderation model
// (omni-moderation-latest, which reads images). Only what clearly does not belong on a profile is
// refused: sexual content, anything sexual involving minors, graphic violence (gore) and self-harm.
// Plain "violence" is ignored on purpose: game screenshots, sports and action scenes score high
// there and are fine. OpenAI's own "flagged" is not used for the same reason.
const LIMITS: Record<string, number> = {
  sexual: 0.4,
  "sexual/minors": 0.05,
  "violence/graphic": 0.7,
  "self-harm": 0.6,
  "self-harm/intent": 0.6,
  "self-harm/instructions": 0.6,
};

export function imageModerationConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function moderateImage(file: File): Promise<{ allowed: boolean; reason: "ok" | "inappropriate" | "unavailable" }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { allowed: true, reason: "ok" };
  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "omni-moderation-latest", input: [{ type: "image_url", image_url: { url: `data:${file.type};base64,${bytes}` } }] }),
    cache: "no-store",
  }).catch(() => null);
  // Unknown is not approved: the person just tries again in a moment.
  if (!response?.ok) return { allowed: false, reason: "unavailable" };
  const result = await response.json() as { results?: Array<{ flagged?: boolean; category_scores?: Record<string, number> }> };
  const scores = result.results?.[0]?.category_scores ?? {};
  const hit = Object.entries(LIMITS).find(([category, limit]) => (scores[category] ?? 0) >= limit);
  if (!hit) return { allowed: true, reason: "ok" };
  // The category and score (never the image) go to /admin/status, to tune the limits if needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createSupabaseServiceClient() as any).from("ErrorEvent").insert({ path: "/consultor/perfil", routeType: "image-moderation", message: `Foto recusada: ${hit[0]} ${(scores[hit[0]] ?? 0).toFixed(2)}` }).then(() => undefined, () => undefined);
  return { allowed: false, reason: "inappropriate" };
}

export function imageModerationMessage(reason: "inappropriate" | "unavailable" | "ok", kind: "foto de perfil" | "capa") {
  return reason === "unavailable"
    ? "Não conseguimos verificar a imagem agora. Tente de novo em alguns instantes."
    : `Esta imagem não pode ser usada como ${kind}. Fotos com nudez, conteúdo sexual, violência explícita ou automutilação são bloqueadas automaticamente. Escolha outra imagem.`;
}
