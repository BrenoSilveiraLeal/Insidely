import { isMeetingRoomOpen } from "@/lib/booking-policy";
import { getAppUrl } from "@/lib/app-url";
import { shortDate } from "@/lib/format";
import { Video } from "lucide-react";
import { GoogleCalendarAddLink } from "@/components/google-calendar-add-link";

const PAID_STATUSES = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"];

// The video room of the booking, one compact bar above the chat: when, the room link and the actions.
export function MeetingRoomMessage({ booking, calendarSide = "customer" }: { booking: { id: string; status: string; startsAt: Date; durationMinutes: number; meetingUrl: string | null }; calendarSide?: "customer" | "consultant" }) {
  if (!PAID_STATUSES.includes(booking.status)) return null;
  const open = isMeetingRoomOpen(booking.startsAt, booking.durationMinutes);
  const roomUrl = `${getAppUrl()}/sala/${booking.id}`;
  return <div className="room-bar" role="note">
    <span className="room-bar-icon" aria-hidden="true"><Video size={18}/></span>
    <div className="room-bar-text">
      <strong>Sala da conversa · {shortDate(booking.startsAt)} · {booking.durationMinutes} min</strong>
      <small>{open ? "A sala está aberta." : "O Google Meet abre no início da conversa e fecha ao fim do horário."} <a href={roomUrl} target="_blank" rel="noreferrer">Link da sala</a></small>
    </div>
    <div className="room-bar-actions">{open && <a className="button button-accent button-sm" href={roomUrl} target="_blank" rel="noreferrer">Entrar na videochamada</a>}<GoogleCalendarAddLink bookingId={booking.id} returnTo={calendarSide === "consultant" ? "/consultor/consultas" : "/dashboard/mensagens"}/></div>
  </div>;
}
