import { isMeetingRoomOpen } from "@/lib/booking-policy";
import { shortDate } from "@/lib/format";

const PAID_STATUSES = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED"];

// Pinned platform message that delivers the video room link inside the booking chat.
export function MeetingRoomMessage({ booking }: { booking: { id: string; status: string; startsAt: Date; durationMinutes: number; meetingUrl: string | null } }) {
  if (!PAID_STATUSES.includes(booking.status)) return null;
  const open = isMeetingRoomOpen(booking.startsAt, booking.durationMinutes);
  return <div className="message message-system" role="note">
    <small>Insidely · mensagem automática</small>
    <p><strong>Sala da conversa: {shortDate(booking.startsAt)} ({booking.durationMinutes} min)</strong></p>
    {booking.meetingUrl ? <>
      <p>{open ? "A sala está aberta. Entre pelo link abaixo." : "Use este link no horário marcado. A entrada é liberada 10 minutos antes."}</p>
      <a className="message-system-link" href={booking.meetingUrl} target="_blank" rel="noreferrer">{booking.meetingUrl}</a>
      <div className="message-system-actions">{open && <a className="button button-accent button-sm" href={booking.meetingUrl} target="_blank" rel="noreferrer">Entrar na videochamada</a>}<a className="button button-ghost button-sm" href={`/api/calendar/${booking.id}`}>Adicionar ao calendário</a></div>
    </> : <p>O link da sala está sendo gerado e aparecerá aqui em instantes.</p>}
  </div>;
}
