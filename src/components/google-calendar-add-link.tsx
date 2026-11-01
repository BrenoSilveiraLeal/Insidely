import { cache } from "react";
import { CalendarCheck, CalendarPlus } from "lucide-react";
import { getCalendarLink } from "@/lib/google-calendar-link";
import { getAuthenticatedUser } from "@/lib/session";

// Whether the viewer linked their Google Agenda, checked once per request however many cards ask.
const viewerLinkedCalendar = cache(async () => {
  const user = await getAuthenticatedUser();
  return user ? Boolean(await getCalendarLink(user.id)) : false;
});

// With the Google Agenda linked the conversation goes into it on its own (lib/google-calendar-link.ts),
// so the button becomes a quiet note instead.
export async function GoogleCalendarAddLink({ bookingId, returnTo, className = "button button-ghost button-sm" }: { bookingId: string; returnTo: string; className?: string }) {
  if (await viewerLinkedCalendar()) return <span className="calendar-added"><CalendarCheck size={15} aria-hidden="true"/>No seu Google Agenda</span>;
  const params = new URLSearchParams({ bookingId, returnTo });
  return <a className={className} href={`/auth/google-calendar?${params.toString()}`}><CalendarPlus size={15} aria-hidden="true"/>Adicionar ao Google Calendário</a>;
}
