import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Consultant replies to reviews (ReviewReply), read beside the public profile view.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = () => createSupabaseServiceClient() as any;

export async function getReviewReplies(reviewIds: string[]) {
  const replies = new Map<string, string>();
  if (!reviewIds.length) return replies;
  const { data } = await service().from("ReviewReply").select("reviewId, body").in("reviewId", reviewIds);
  for (const row of (data ?? []) as { reviewId: string; body: string }[]) replies.set(row.reviewId, row.body);
  return replies;
}

export async function viewerOwnsProfile(userId: string | undefined, profileId: string) {
  if (!userId) return false;
  const { data } = await service().from("ProfessionalProfile").select("id").eq("id", profileId).eq("userId", userId).maybeSingle();
  return Boolean(data);
}

export function reviewFeedback(report?: string, reply?: string) {
  const texts: Record<string, { ok: boolean; text: string }> = {
    denunciada: { ok: true, text: "Denúncia enviada. A equipe vai analisar a avaliação." },
    curta: { ok: false, text: "Explique o motivo da denúncia com pelo menos 10 caracteres." },
    limite: { ok: false, text: "Você enviou muitas denúncias em pouco tempo. Aguarde uma hora." },
  };
  const replyTexts: Record<string, { ok: boolean; text: string }> = {
    ok: { ok: true, text: "Resposta publicada." },
    curta: { ok: false, text: "Escreva a resposta antes de publicar." },
    ofensiva: { ok: false, text: "A resposta tem palavrões ou ofensas. Reescreva para publicar." },
    contato: { ok: false, text: "A resposta parece ter telefone, e-mail, link ou rede social. Reescreva sem dados de contato." },
    repetida: { ok: false, text: "Esta avaliação já tem uma resposta sua." },
  };
  return (report && texts[report]) || (reply && replyTexts[reply]) || null;
}
