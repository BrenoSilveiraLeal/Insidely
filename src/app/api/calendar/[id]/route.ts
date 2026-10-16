import { getConsultantBookings, getViewerDashboard } from "@/lib/queries";
import { getAuthenticatedUser } from "@/lib/session";
import { Role } from "@/lib/domain";
import { buildConversationIcs } from "@/lib/calendar";
import { getAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";


export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const requestedSide = new URL(request.url).searchParams.get("side");
  const side = requestedSide === "customer" || requestedSide === "consultant"
    ? requestedSide
    : user.role === Role.CONSULTANT ? "consultant" : "customer";
  if (side === "consultant" && user.role !== Role.CONSULTANT) return new Response("Not found", { status: 404 });
  const booking = side === "consultant"
    ? (await getConsultantBookings(user.id, 1, 100)).items.find((item) => item.id === id)
    : (await getViewerDashboard(user.id))?.customerBookings.find((item) => item.id === id);
  if (!booking) return new Response("Not found", { status: 404 });

  const body = buildConversationIcs({ ...booking, roomUrl: booking.meetingUrl ? `${getAppUrl()}/sala/${booking.id}` : null });
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="insidely-${booking.id}.ics"`, "Cache-Control": "private, no-store" } });
}
