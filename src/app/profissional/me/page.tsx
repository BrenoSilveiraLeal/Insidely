import { redirect } from "next/navigation";
import { Role } from "@/lib/domain";
import { getConsultantDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export default async function Page() {
  const user = await requireUser([Role.CONSULTANT]);
  const profile = await getConsultantDashboard(user.id);
  if (!profile?.id) redirect("/consultor/perfil");
  redirect(`/profissional/${profile.id}`);
}
