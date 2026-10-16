import { getConsultantDashboard, getViewerDashboard } from "@/lib/queries";
import { getAuthenticatedUser } from "@/lib/session";
import { Role } from "@/lib/domain";
import { buildConversationIcs } from "@/lib/calendar";

export const dynamic = "force-dynamic";


export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const booking = user.role === Role.CONSULTANT
    ? (await getConsultantDashboard(user.id))?.bookings.find((item) => item.id === id)
    : (await getViewerDashboard(user.id))?.customerBookings.find((item) => item.id === id);
  if (!booking) return new Response("Not found", { status: 404 });

  const body = buildConversationIcs(booking);
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="insidely-${booking.id}.ics"`, "Cache-Control": "private, no-store" } });
}
