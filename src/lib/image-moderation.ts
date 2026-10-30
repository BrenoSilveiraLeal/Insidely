import "server-only";

// Profile photos and covers are checked before upload with OpenAI's free moderation model
// (omni-moderation-latest, which reads images). Stricter than its default "flagged": a photo
// is refused already at moderate scores for sexual content, nudity involving minors, graphic
// violence or self-harm. Without OPENAI_API_KEY the check is off and /admin/status shows it.
const LIMITS: Record<string, number> = {
  sexual: 0.2,
  "sexual/minors": 0.01,
  violence: 0.6,
  "violence/graphic": 0.3,
  "self-harm": 0.3,
  "self-harm/intent": 0.3,
  "self-harm/instructions": 0.3,
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
  const first = result.results?.[0];
  const scores = first?.category_scores ?? {};
  const tooHigh = Object.entries(LIMITS).some(([category, limit]) => (scores[category] ?? 0) >= limit);
  return first?.flagged || tooHigh ? { allowed: false, reason: "inappropriate" } : { allowed: true, reason: "ok" };
}

export function imageModerationMessage(reason: "inappropriate" | "unavailable" | "ok", kind: "foto de perfil" | "capa") {
  return reason === "unavailable"
    ? "Não conseguimos verificar a imagem agora. Tente de novo em alguns instantes."
    : `Esta imagem não pode ser usada como ${kind}. Fotos com nudez, conteúdo sexual, violência ou automutilação são bloqueadas automaticamente. Escolha outra imagem.`;
}
