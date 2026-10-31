import { meetingRoomState } from "@/lib/booking-policy";
import { getAppUrl } from "@/lib/app-url";
import { shortDate } from "@/lib/format";
import { Video } from "lucide-react";
import { GoogleCalendarAddLink } from "@/components/google-calendar-add-link";

const PAID_STATUSES = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"];

// The video room of the booking, one compact bar above the chat: when, the room link and the actions.
export function MeetingRoomMessage({ booking, calendarSide = "customer" }: { booking: { id: string; status: string; startsAt: Date; durationMinutes: number; meetingUrl: string | null }; calendarSide?: "customer" | "consultant" }) {
  if (!PAID_STATUSES.includes(booking.status)) return null;
  // Before the start the link leads to the room page (it says when it opens); during the slot it enters
  // the Meet; afterwards (or once the conversation was finished) the button stays, disabled.
  const state = booking.status === "CONFIRMED" ? meetingRoomState(booking.startsAt, booking.durationMinutes) : "ended";
  const roomUrl = `${getAppUrl()}/sala/${booking.id}`;
  return <div className="room-bar" role="note">
    <span className="room-bar-icon" aria-hidden="true"><Video size={18}/></span>
    <div className="room-bar-text">
      <strong>Sala da conversa · {shortDate(booking.startsAt)} · {booking.durationMinutes} min</strong>
      <small>{state === "open" ? "A sala está aberta. Entre pelo botão." : state === "ended" ? "O horário da conversa acabou e a sala foi encerrada." : "O Google Meet abre no início da conversa e fecha ao fim do horário."}</small>
    </div>
    <div className="room-bar-actions">
      {state === "ended"
        ? <button type="button" className="button button-accent button-sm" disabled>Tempo encerrado</button>
        : <a className="button button-accent button-sm" href={roomUrl} target="_blank" rel="noreferrer">{state === "open" ? "Entrar na videochamada" : "Link da sala"}</a>}
      {state !== "ended" && <GoogleCalendarAddLink bookingId={booking.id} returnTo={calendarSide === "consultant" ? "/consultor/consultas" : "/dashboard/mensagens"}/>}
    </div>
  </div>;
}
