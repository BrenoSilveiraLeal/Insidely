import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = () => createSupabaseServiceClient() as any;

export type CompletenessItem = { label: string; detail: string; done: boolean; href: string };

// "Perfil completo": what makes a profile convert, with a link to fix each missing item.
export async function getProfileCompleteness(userId: string): Promise<{ percent: number; items: CompletenessItem[] }> {
  const supabase = service();
  const [{ data: user }, { data: profile }] = await Promise.all([
    supabase.from("User").select("image").eq("id", userId).maybeSingle(),
    supabase.from("ProfessionalProfile").select("id, bio, verificationStatus, welcomeMessage, salaryRange, areaPro, pixKey").eq("userId", userId).maybeSingle(),
  ]);
  if (!profile) return { percent: 0, items: [] };
  const [{ count: freeSlots }, { data: cover }] = await Promise.all([
    supabase.from("Availability").select("id", { count: "exact", head: true }).eq("professionalProfileId", profile.id).eq("isBooked", false).gt("startsAt", new Date().toISOString()),
    supabase.from("ProfileCover").select("image").eq("professionalProfileId", profile.id).maybeSingle(),
  ]);
  const bioLength = (profile.bio ?? "").trim().length;
  const items: CompletenessItem[] = [
    { label: "Foto de perfil", detail: "A foto redonda que aparece no seu cartão.", done: Boolean(user?.image), href: "/consultor/perfil" },
    { label: "Foto de capa", detail: "A imagem grande no topo do seu perfil público (diferente da foto de perfil).", done: Boolean(cover?.image), href: "/consultor/perfil" },
    { label: "Apresentação", detail: bioLength >= 120 ? "Pronta." : `${bioLength} de 120 caracteres: conte mais sobre o que você pode contextualizar.`, done: bioLength >= 120, href: "/consultor/perfil" },
    { label: "Chave Pix", detail: "Para onde vai o valor das suas conversas.", done: Boolean(profile.pixKey?.trim()), href: "/consultor/perfil" },
    { label: "Horários livres", detail: "Pelo menos um horário livre na agenda.", done: (freeSlots ?? 0) > 0, href: "/consultor/agenda" },
    { label: "Vínculo verificado", detail: "Envie o comprovante (crachá, holerite ou carteira de trabalho) em Editar perfil.", done: profile.verificationStatus === "VERIFIED", href: "/consultor/perfil" },
    { label: "Mensagem de boas-vindas", detail: "O texto enviado no chat quando alguém agenda com você.", done: Boolean(profile.welcomeMessage), href: "/consultor/perfil" },
    { label: "Sobre a sua área", detail: "Faixa salarial, uma coisa boa e uma difícil da rotina.", done: Boolean(profile.salaryRange || profile.areaPro), href: "/consultor/perfil" },
  ];
  return { percent: Math.round(items.filter((item) => item.done).length / items.length * 100), items };
}

// Last 30 days: profile views, conversations booked, conversion, average rating and earnings.
export async function getConsultantPerformance(profileId: string) {
  const supabase = service();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const paid = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"];
  const [{ count: views }, { data: bookings }, { data: reviews }, { data: owner }] = await Promise.all([
    supabase.from("ProfileView").select("id", { count: "exact", head: true }).eq("professionalProfileId", profileId).gte("viewedAt", since),
    supabase.from("Booking").select("totalCents, feeCents, status, customerId").eq("professionalProfileId", profileId).gte("createdAt", since).in("status", paid),
    supabase.from("Review").select("rating").eq("professionalProfileId", profileId),
    supabase.from("ProfessionalProfile").select("userId").eq("id", profileId).maybeSingle(),
  ]);
  // A consultant booking their own profile (testing as a customer) is not a conversion.
  const fromOthers = ((bookings ?? []) as { customerId: string; totalCents: number; feeCents: number }[]).filter((row) => row.customerId !== owner?.userId);
  const booked = fromOthers.length;
  const earnings = fromOthers.reduce((sum: number, row: { totalCents: number; feeCents: number }) => sum + row.totalCents - row.feeCents, 0);
  const ratings = (reviews ?? []) as { rating: number }[];
  return {
    views: views ?? 0,
    booked,
    // Share of profile visits that became a conversation. Someone can book through a direct link
    // without a counted visit, so the ratio is capped at 100%.
    conversion: views ? Math.min(100, Math.round(booked / views * 1000) / 10) : null,
    rating: ratings.length ? ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length : null,
    earnings,
  };
}
