import { CalendarPlus } from "lucide-react";

export function GoogleCalendarAddLink({ bookingId, returnTo, className = "button button-ghost button-sm" }: { bookingId: string; returnTo: string; className?: string }) {
  const params = new URLSearchParams({ bookingId, returnTo });
  return <a className={className} href={`/auth/google-calendar?${params.toString()}`}><CalendarPlus size={15} aria-hidden="true"/>Adicionar ao Google Calendário</a>;
}
