import { isMeetingRoomOpen } from "@/lib/booking-policy";
import { googleCalendarUrl } from "@/lib/calendar";
import { getAppUrl } from "@/lib/app-url";
import { shortDate } from "@/lib/format";

const PAID_STATUSES = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED"];

// Pinned platform message that delivers the video room link inside the booking chat.
export function MeetingRoomMessage({ booking, calendarSide = "customer" }: { booking: { id: string; status: string; startsAt: Date; durationMinutes: number; meetingUrl: string | null }; calendarSide?: "customer" | "consultant" }) {
  if (!PAID_STATUSES.includes(booking.status)) return null;
  const open = isMeetingRoomOpen(booking.startsAt, booking.durationMinutes);
  // The Insidely link checks participant and schedule before redirecting to the Meet room.
  const roomUrl = `${getAppUrl()}/sala/${booking.id}`;
  return <div className="message message-system" role="note">
    <small>Insidely Â· mensagem automÃ¡tica</small>
    <p><strong>Sala da conversa: {shortDate(booking.startsAt)} ({booking.durationMinutes} min)</strong></p>
    {booking.meetingUrl ? <>
      <p>{open ? "A sala estÃ¡ aberta. Entre pelo link abaixo." : "Use este link no horÃ¡rio marcado. Ele sÃ³ abre a sala do Google Meet a partir de 10 minutos antes."}</p>
      <a className="message-system-link" href={roomUrl} target="_blank" rel="noreferrer">{roomUrl.replace(/^https?:\/\//, "")}</a>
      <div className="message-system-actions">{open && <a className="button button-accent button-sm" href={roomUrl} target="_blank" rel="noreferrer">Entrar na videochamada</a>}<a className="button button-ghost button-sm" href={googleCalendarUrl({ startsAt: booking.startsAt, durationMinutes: booking.durationMinutes, goals: "", roomUrl: booking.meetingUrl })} target="_blank" rel="noreferrer">Adicionar ao Google Calendar</a></div>
    </> : <p>O link da sala estÃ¡ sendo gerado e aparecerÃ¡ aqui em instantes.</p>}
  </div>;
}
