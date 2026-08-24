import { getConsultantDashboard, getViewerDashboard } from "@/lib/queries";
import { getAuthenticatedUser } from "@/lib/session";
import { Role } from "@/lib/domain";

export const dynamic = "force-dynamic";

function icsDate(date: Date) { return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
function escapeIcs(value: string) { return value.replace(/\\/g, "\\\\").replace(/[;,]/g, (match) => `\\${match}`).replace(/\r?\n/g, "\\n"); }

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const booking = user.role === Role.CONSULTANT
    ? (await getConsultantDashboard(user.id))?.bookings.find((item) => item.id === id)
    : (await getViewerDashboard(user.id))?.customerBookings.find((item) => item.id === id);
  if (!booking) return new Response("Not found", { status: 404 });

  const end = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60_000);
  const description = ["Conversa profissional pela Insidely", booking.goals, booking.meetingUrl ? `Sala: ${booking.meetingUrl}` : "Sala online a confirmar"].filter(Boolean).join("\\n\\n");
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Insidely//Conversa profissional//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:insidely-${booking.id}@insidely`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(booking.startsAt)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${escapeIcs("Conversa Insidely")}`, `DESCRIPTION:${escapeIcs(description)}`, booking.meetingUrl ? `LOCATION:${escapeIcs(booking.meetingUrl)}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n") + "\r\n";
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="insidely-${booking.id}.ics"`, "Cache-Control": "private, no-store" } });
}
