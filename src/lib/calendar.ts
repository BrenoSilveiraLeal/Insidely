type CalendarBooking = { id: string; startsAt: Date; durationMinutes: number; goals?: string | null; meetingUrl?: string | null };

function icsDate(date: Date) { return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
function escapeIcs(value: string) { return value.replace(/\\/g, "\\\\").replace(/[;,]/g, (match) => `\\${match}`).replace(/\r?\n/g, "\\n"); }

// iCalendar event for a conversation, with a reminder alarm 30 minutes before it starts.
export function buildConversationIcs(booking: CalendarBooking) {
  const end = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60_000);
  const description = ["Conversa profissional pela Insidely", booking.goals, booking.meetingUrl ? `Sala: ${booking.meetingUrl}` : "Sala online a confirmar"].filter(Boolean).join("\n\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Insidely//Conversa profissional//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:insidely-${booking.id}@insidely`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(booking.startsAt)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${escapeIcs("Conversa Insidely")}`, `DESCRIPTION:${escapeIcs(description)}`, booking.meetingUrl ? `LOCATION:${escapeIcs(booking.meetingUrl)}` : "",
    booking.meetingUrl ? `URL:${booking.meetingUrl}` : "",
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeIcs("Sua conversa na Insidely começa em 30 minutos")}`, "TRIGGER:-PT30M", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n") + "\r\n";
}
