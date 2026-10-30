import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = () => createSupabaseServiceClient() as any;

export type CompletenessItem = { label: string; done: boolean; href: string };

// "Perfil completo": what makes a profile convert, with a link to fix each missing item.
export async function getProfileCompleteness(userId: string): Promise<{ percent: number; items: CompletenessItem[] }> {
  const supabase = service();
  const [{ data: user }, { data: profile }] = await Promise.all([
    supabase.from("User").select("image").eq("id", userId).maybeSingle(),
    supabase.from("ProfessionalProfile").select("id, bio, verificationStatus, welcomeMessage, salaryRange, areaPro").eq("userId", userId).maybeSingle(),
  ]);
  if (!profile) return { percent: 0, items: [] };
  const [{ count: freeSlots }, { data: cover }] = await Promise.all([
    supabase.from("Availability").select("id", { count: "exact", head: true }).eq("professionalProfileId", profile.id).eq("isBooked", false).gt("startsAt", new Date().toISOString()),
    supabase.from("ProfileCover").select("image").eq("professionalProfileId", profile.id).maybeSingle(),
  ]);
  const items: CompletenessItem[] = [
    { label: "Foto de perfil", done: Boolean(user?.image), href: "/consultor/perfil" },
    { label: "Foto de capa", done: Boolean(cover?.image), href: "/consultor/perfil" },
    { label: "Apresentação com pelo menos 120 caracteres", done: (profile.bio ?? "").trim().length >= 120, href: "/consultor/perfil" },
    { label: "Horários livres na agenda", done: (freeSlots ?? 0) > 0, href: "/consultor/agenda" },
    { label: "Vínculo com a empresa verificado", done: profile.verificationStatus === "VERIFIED", href: "/consultor/perfil" },
    { label: "Mensagem de boas-vindas", done: Boolean(profile.welcomeMessage), href: "/consultor/perfil" },
    { label: "Informações sobre a sua área", done: Boolean(profile.salaryRange || profile.areaPro), href: "/consultor/perfil" },
  ];
  return { percent: Math.round(items.filter((item) => item.done).length / items.length * 100), items };
}

// Last 30 days: profile views, conversations booked, conversion, average rating and earnings.
export async function getConsultantPerformance(profileId: string) {
  const supabase = service();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const paid = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"];
  const [{ count: views }, { data: bookings }, { data: reviews }] = await Promise.all([
    supabase.from("ProfileView").select("id", { count: "exact", head: true }).eq("professionalProfileId", profileId).gte("viewedAt", since),
    supabase.from("Booking").select("totalCents, feeCents, status").eq("professionalProfileId", profileId).gte("createdAt", since).in("status", paid),
    supabase.from("Review").select("rating").eq("professionalProfileId", profileId),
  ]);
  const booked = (bookings ?? []).length;
  const earnings = (bookings ?? []).reduce((sum: number, row: { totalCents: number; feeCents: number }) => sum + row.totalCents - row.feeCents, 0);
  const ratings = (reviews ?? []) as { rating: number }[];
  return {
    views: views ?? 0,
    booked,
    conversion: views ? Math.round(booked / views * 1000) / 10 : null,
    rating: ratings.length ? ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length : null,
    earnings,
  };
}
