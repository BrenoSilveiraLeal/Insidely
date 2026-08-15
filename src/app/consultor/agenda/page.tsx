import { Role } from "@/lib/domain";
import { AvailabilityManager } from "@/components/consultant-availability";
import { DashboardShell } from "@/components/dashboard-shell";
import { getConsultantDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser([Role.CONSULTANT]); const profile = await getConsultantDashboard(user.id);
  const slots = (profile?.availability ?? []).filter((slot) => slot.endsAt > new Date()).map((slot) => ({ id: slot.id, startsAt: slot.startsAt.toISOString(), endsAt: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(slot.endsAt), isBooked: slot.isBooked, label: shortDate(slot.startsAt) }));
  return <DashboardShell mode="consultant" title="Agenda"><AvailabilityManager slots={slots}/></DashboardShell>;
}
