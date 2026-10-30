import "server-only";
import { parseDbDate } from "@/lib/format";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const PAID = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED", "DISPUTED"];
const monthKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(date);
const monthLabel = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "short" }).format(date).replace(".", "");

// Admin overview indicators: last 6 months of conversations and reports, plus 30-day rates.
export async function getAdminMetrics() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const now = new Date();
  const sixMonths = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
  const month = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [{ data: bookings }, { data: reports }, { count: blocked }, { data: surveys }, { data: reviews }, { data: checked }] = await Promise.all([
    supabase.from("Booking").select("startsAt, status, feeCents").in("status", PAID).gte("startsAt", sixMonths),
    supabase.from("Report").select("createdAt").gte("createdAt", sixMonths),
    supabase.from("ChatModerationEvent").select("id", { count: "exact", head: true }).gte("createdAt", month),
    supabase.from("ConversationSurvey").select("answer"),
    supabase.from("Review").select("rating"),
    supabase.from("Booking").select("id, customerId, professionalProfile:ProfessionalProfile(userId)").not("noShowCheckedAt", "is", null).gte("startsAt", month),
  ]);
  const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 15));
  const series = (rows: { date: Date }[]) => months.map((date) => ({ label: monthLabel(date), value: rows.filter((row) => monthKey(row.date) === monthKey(date)).length }));
  const conversations = series(((bookings ?? []) as { startsAt: string }[]).map((row) => ({ date: parseDbDate(row.startsAt) })));
  const reportSeries = series(((reports ?? []) as { createdAt: string }[]).map((row) => ({ date: parseDbDate(row.createdAt) })));
  const revenue = ((bookings ?? []) as { startsAt: string; feeCents: number }[]).filter((row) => parseDbDate(row.startsAt) >= new Date(month)).reduce((sum, row) => sum + row.feeCents, 0);
  const answers = (surveys ?? []) as { answer: string }[];
  const helped = answers.length ? Math.round(answers.filter((row) => row.answer === "YES").length / answers.length * 100) : null;
  const partly = answers.length ? Math.round(answers.filter((row) => row.answer === "PARTLY").length / answers.length * 100) : null;
  const ratings = (reviews ?? []) as { rating: number }[];
  // Attendance: share of tracked conversations where both people entered the room.
  const tracked = (checked ?? []) as { id: string; customerId: string; professionalProfile: { userId: string } | { userId: string }[] | null }[];
  let attendance: number | null = null, noShows = 0;
  if (tracked.length) {
    const { data: entries } = await supabase.from("RoomAttendance").select("bookingId, userId").in("bookingId", tracked.map((row) => row.id));
    let both = 0;
    for (const row of tracked) {
      const consultant = (Array.isArray(row.professionalProfile) ? row.professionalProfile[0] : row.professionalProfile)?.userId;
      const entered = new Set(((entries ?? []) as { bookingId: string; userId: string }[]).filter((entry) => entry.bookingId === row.id).map((entry) => entry.userId));
      if (entered.has(row.customerId) && consultant && entered.has(consultant)) both++;
      else if (entered.size === 1) noShows++;
    }
    attendance = Math.round(both / tracked.length * 100);
  }
  return {
    conversations, reports: reportSeries, blockedMessages: blocked ?? 0, helped, partly, surveyAnswers: answers.length,
    rating: ratings.length ? ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length : null,
    attendance, noShows, revenue,
  };
}
