import { getAuthenticatedUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// LGPD art. 18 (access and portability): a JSON file with everything the platform keeps about the
// signed-in person. Read with the service role, always scoped to the authenticated account.
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const id = user.id;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("*, experiences:EmploymentExperience(*), privacy:PrivacySettings(*)").eq("userId", id).maybeSingle();
  const [account, identity, bookings, messages, reviews, favorites, notifications, feedback, accessLog, consultantBookings] = await Promise.all([
    supabase.from("User").select("id, name, email, role, image, createdAt, updatedAt, termsVersion, termsAcceptedAt, suspendedAt, suspendedUntil, suspensionReason").eq("id", id).maybeSingle(),
    supabase.from("CustomerIdentity").select("cpf, birthDate, createdAt").eq("userId", id).maybeSingle(),
    supabase.from("Booking").select("id, status, startsAt, durationMinutes, topics, goals, totalCents, createdAt").eq("customerId", id),
    supabase.from("Message").select("id, conversationId, body, createdAt, readAt").eq("senderId", id),
    supabase.from("Review").select("id, bookingId, rating, comment, createdAt").eq("userId", id),
    supabase.from("Favorite").select("professionalProfileId, createdAt").eq("userId", id),
    supabase.from("Notification").select("title, body, createdAt, readAt").eq("userId", id),
    supabase.from("CustomerFeedback").select("rating, comment, createdAt").eq("customerId", id),
    supabase.from("AccessLog").select("ip, userAgent, method, createdAt").eq("userId", id).order("createdAt", { ascending: false }),
    profile ? supabase.from("Booking").select("id, status, startsAt, durationMinutes, topics, goals, totalCents, feeCents, createdAt").eq("professionalProfileId", profile.id) : Promise.resolve({ data: [] }),
  ]);
  const body = {
    geradoEm: new Date().toISOString(),
    aviso: "Cópia dos seus dados guardados pela Insidely (LGPD, art. 18). Senhas não são guardadas em texto e não aparecem aqui.",
    conta: account.data, identificacao: identity.data, agendamentosComoCliente: bookings.data, mensagensEnviadas: messages.data,
    avaliacoesFeitas: reviews.data, favoritos: favorites.data, notificacoes: notifications.data, avaliacoesRecebidasComoCliente: feedback.data,
    perfilDeConsultor: profile, agendamentosComoConsultor: consultantBookings.data, registrosDeAcesso: accessLog.data,
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="insidely-meus-dados.json"`, "Cache-Control": "private, no-store" } });
}
