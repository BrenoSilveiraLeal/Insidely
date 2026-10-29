import { isMeetingRoomOpen } from "@/lib/booking-policy";
import { getAppUrl } from "@/lib/app-url";
import { shortDate } from "@/lib/format";
import { GoogleCalendarAddLink } from "@/components/google-calendar-add-link";

const PAID_STATUSES = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"];

// Pinned platform message that delivers the video room link inside the booking chat.
export function MeetingRoomMessage({ booking, calendarSide = "customer" }: { booking: { id: string; status: string; startsAt: Date; durationMinutes: number; meetingUrl: string | null }; calendarSide?: "customer" | "consultant" }) {
  if (!PAID_STATUSES.includes(booking.status)) return null;
  const open = isMeetingRoomOpen(booking.startsAt, booking.durationMinutes);
  const roomUrl = `${getAppUrl()}/sala/${booking.id}`;
  return <div className="message message-system" role="note">
    <small>Insidely · mensagem automática</small>
    <p><strong>Sala da conversa: {shortDate(booking.startsAt)} ({booking.durationMinutes} min)</strong></p>
    <p>{open ? "A sala está aberta. Entre pelo link abaixo." : "Use este link no horário marcado. A sala do Google Meet só é criada e liberada no início da conversa e é encerrada ao fim do horário."}</p>
    <a className="message-system-link" href={roomUrl} target="_blank" rel="noreferrer">{roomUrl.replace(/^https?:\/\//, "")}</a>
    <div className="message-system-actions">{open && <a className="button button-accent button-sm" href={roomUrl} target="_blank" rel="noreferrer">Entrar na videochamada</a>}<GoogleCalendarAddLink bookingId={booking.id} returnTo={calendarSide === "consultant" ? "/consultor/consultas" : "/dashboard/mensagens"}/></div>
  </div>;
}
