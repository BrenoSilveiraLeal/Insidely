import { parseDbDate } from "./format";

// Run by the 5-minute cron. Once a paid conversation's time is over, compares who entered the room
// (RoomAttendance, written by /sala) and warns the side that showed up when the other did not.
// Each booking is checked once ("noShowCheckedAt").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkNoShows(supabase: any, now = new Date()) {
  const { data: bookings, error } = await supabase.from("Booking")
    .select("id, startsAt, durationMinutes, customerId, professionalProfileId")
    .in("status", ["CONFIRMED", "AWAITING_CONFIRMATION"]).eq("format", "VIDEO").is("noShowCheckedAt", null)
    .gt("startsAt", new Date(now.getTime() - 2 * 24 * 60 * 60_000).toISOString()).lte("startsAt", now.toISOString())
    .limit(50);
  if (error) { console.error("no_show_lookup_failed", { error }); return 0; }
  let flagged = 0;
  for (const booking of bookings ?? []) {
    if (parseDbDate(booking.startsAt).getTime() + booking.durationMinutes * 60_000 > now.getTime()) continue;
    const { data: claimed } = await supabase.from("Booking").update({ noShowCheckedAt: now.toISOString() }).eq("id", booking.id).is("noShowCheckedAt", null).select("id").maybeSingle();
    if (!claimed) continue;
    const { data: profile } = await supabase.from("ProfessionalProfile").select("userId").eq("id", booking.professionalProfileId).maybeSingle();
    if (!profile || profile.userId === booking.customerId) continue;
    const { data: entries } = await supabase.from("RoomAttendance").select("userId").eq("bookingId", booking.id);
    const entered = new Set((entries ?? []).map((item: { userId: string }) => item.userId));
    const customerIn = entered.has(booking.customerId), consultantIn = entered.has(profile.userId);
    if (customerIn === consultantIn) continue;
    const at = now.toISOString();
    const rows = customerIn
      ? [{ id: crypto.randomUUID(), userId: booking.customerId, title: "O consultor não entrou na sala", body: "Pelo nosso registro, o consultor não entrou na sala no horário da conversa. Se ela não aconteceu, abra uma contestação em Agendamentos: com a contestação, o valor não é repassado e o caso vai para o suporte.", href: "/dashboard/agendamentos", createdAt: at }]
      : [{ id: crypto.randomUUID(), userId: profile.userId, title: "O cliente não entrou na sala", body: "Pelo nosso registro, o cliente não entrou na sala no horário da conversa. Se precisar, informe o ocorrido em Consultas.", href: "/consultor/consultas", createdAt: at }];
    const { data: admins } = await supabase.from("User").select("id").eq("role", "ADMIN");
    for (const admin of admins ?? []) rows.push({ id: crypto.randomUUID(), userId: admin.id, title: customerIn ? "Possível falta de consultor" : "Possível falta de cliente", body: `Conversa ${booking.id}: só ${customerIn ? "o cliente" : "o consultor"} entrou na sala.`, href: "/admin/denuncias", createdAt: at });
    const { error: notificationError } = await supabase.from("Notification").insert(rows);
    if (notificationError) console.error("no_show_notification_failed", { bookingId: booking.id, error: notificationError });
    flagged++;
  }
  return flagged;
}

const time = (value: string) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(parseDbDate(value));

// One line per booking for the admin: who entered through /sala and what Google Meet reported.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAttendanceSummaries(supabase: any, bookingIds: string[]) {
  const result = new Map<string, string>();
  if (!bookingIds.length) return result;
  const [{ data: bookings }, { data: entries }] = await Promise.all([
    supabase.from("Booking").select("id, startsAt, customerId, meetingParticipants, professionalProfile:ProfessionalProfile(userId)").in("id", bookingIds),
    supabase.from("RoomAttendance").select("bookingId, userId, firstEnteredAt").in("bookingId", bookingIds),
  ]);
  for (const booking of bookings ?? []) {
    const consultantId = Array.isArray(booking.professionalProfile) ? booking.professionalProfile[0]?.userId : booking.professionalProfile?.userId;
    const entry = (userId: string) => (entries ?? []).find((item: { bookingId: string; userId: string }) => item.bookingId === booking.id && item.userId === userId);
    const customer = entry(booking.customerId), consultant = consultantId ? entry(consultantId) : null;
    const meet = Array.isArray(booking.meetingParticipants) ? ` · Google Meet: ${booking.meetingParticipants.length ? booking.meetingParticipants.map((item: { name: string }) => item.name).join(", ") : "ninguém"}` : "";
    result.set(booking.id, `Presença: cliente ${customer ? `entrou ${time(customer.firstEnteredAt)}` : "não entrou"} · consultor ${consultant ? `entrou ${time(consultant.firstEnteredAt)}` : "não entrou"}${meet}`);
  }
  return result;
}
