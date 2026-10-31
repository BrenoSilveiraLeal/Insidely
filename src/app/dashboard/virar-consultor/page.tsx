import { getJobSuggestions } from "@/lib/job-suggestions";
import { redirect } from "next/navigation";
import { BecomeConsultantForm } from "@/components/become-consultant-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { getPublicCompanies, getPublicProfessions } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Virar consultor" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser([Role.USER, Role.CONSULTANT]);
  if (user.role !== Role.USER) redirect(user.role === Role.CONSULTANT ? "/consultor" : "/admin");
  const [companies, professions, jobs] = await Promise.all([getPublicCompanies(), getPublicProfessions(), getJobSuggestions()]);
  return <DashboardShell mode="user" title="Virar consultor">
    <div className="profile-management-stack">
      <section className="panel">
        <span className="eyebrow">Mesma conta, dois modos</span>
        <h2>Compartilhe sua experiência profissional.</h2>
        <p className="muted">Você continua com tudo o que já tem como cliente: agendamentos, mensagens, favoritos e avaliações. Depois de criar o perfil, alterne entre o modo consultor e o modo cliente pelo menu lateral. Foto, disponibilidade, verificação e demais detalhes do perfil ficam na área do consultor.</p>
      </section>
      <section className="panel"><BecomeConsultantForm companies={companies} professions={professions} jobTitles={jobs.titles}/></section>
    </div>
  </DashboardShell>;
}
