import { getJobSuggestions } from "@/lib/job-suggestions";
import { ProfileCompleteness } from "@/components/profile-completeness";
import { getProfileCompleteness } from "@/lib/consultant-insights";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getPublicCompanies, getPublicProfessions, getConsultantDashboard } from "@/lib/queries";
import { Role, VerificationStatus } from "@/lib/domain";
import { BadgeCheck, Building2, CircleAlert, Clock3, ImageIcon, MessageCircleHeart, ShieldCheck, Sparkles } from "lucide-react";
import { EditBox } from "@/components/edit-box";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProfessionalProfileForm, VerificationRequestForm, WelcomeMessageForm, AreaInsightsForm } from "@/components/profile-management";
import { ProfileImageForm } from "@/components/profile-image-form";
import { ProfileCoverForm } from "@/components/profile-cover-form";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Editar perfil" };
export const dynamic = "force-dynamic";
const statusContent = { NOT_SUBMITTED: { label: "Vínculo não verificado", copy: "Seu perfil aparece como “não verificado”. Envie um comprovante de que trabalha (ou trabalhou) na empresa informada: crachá, folha de ponto ou holerite, carteira de trabalho digital ou outro documento.", icon: CircleAlert }, PENDING: { label: "Comprovante em análise", copy: "Seu comprovante chegou à equipe da Insidely. Você recebe uma notificação com o resultado e, enquanto isso, pode enviar o de outra empresa em que trabalhou.", icon: Clock3 }, VERIFIED: { label: "Vínculo verificado", copy: "Seu perfil mostra que o vínculo foi verificado pela Insidely. Se trabalhou em outras empresas, pode comprovar cada uma.", icon: BadgeCheck }, REJECTED: { label: "Comprovante não aprovado", copy: "Seu perfil continua como “não verificado”. Você pode enviar outro comprovante abaixo.", icon: CircleAlert }, MORE_INFO_REQUIRED: { label: "Precisamos de mais informações", copy: "Envie um novo comprovante.", icon: CircleAlert } } as const;

export default async function Page() {
  const user = await requireUser([Role.CONSULTANT]);
  const [profile, companies, professions, jobs] = await Promise.all([getConsultantDashboard(user.id), getPublicCompanies(), getPublicProfessions(), getJobSuggestions()]);
  // messagePriceCents comes from migration 20261101103000 (null = the message format is off).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messageRow } = profile ? await (createSupabaseServiceClient() as any).from("ProfessionalProfile").select("messagePriceCents").eq("id", profile.id).maybeSingle() : { data: null };
  const messagePrice = typeof messageRow?.messagePriceCents === "number" ? messageRow.messagePriceCents : null;
  const status = profile?.verificationStatus ?? VerificationStatus.NOT_SUBMITTED;
  const content = statusContent[status as keyof typeof statusContent] ?? statusContent.NOT_SUBMITTED;
  const completeness = await getProfileCompleteness(user.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: welcome } = await (createSupabaseServiceClient() as any).from("ProfessionalProfile").select("welcomeMessage, salaryRange, areaPro, areaCon").eq("userId", user.id).maybeSingle();
  // One proof per experience (Verification.experienceId); older proofs without it cover the main
  // experience (current, or else the most recent). adminNotes holds the reason of a rejection.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proofRows } = profile?.id ? await (createSupabaseServiceClient() as any).from("Verification").select("experienceId, status, adminNotes, updatedAt").eq("professionalProfileId", profile.id).order("updatedAt", { ascending: false }) : { data: [] };
  const experiences = [...(profile?.experiences ?? [])].filter((exp) => exp.id).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || String(b.startedAt ?? "").localeCompare(String(a.startedAt ?? "")));
  const proofs = (proofRows ?? []) as { experienceId: string | null; status: string; adminNotes: string | null }[];
  const proofOf = (experienceId: string, main: boolean) => { const own = proofs.filter((row) => row.experienceId === experienceId || (main && !row.experienceId)); return own.find((row) => row.status === "VERIFIED") ?? own[0] ?? null; };
  const companyName = (companyId: string) => companies.find((company) => company.id === companyId)?.name ?? "Empresa";
  const proofRowsByExperience = experiences.map((exp, index) => ({ exp, proof: proofOf(exp.id, index === 0) }));
  const requestable = proofRowsByExperience.filter(({ proof }) => proof?.status !== "VERIFIED" && proof?.status !== "PENDING").map(({ exp }) => ({ id: exp.id, label: `${companyName(exp.companyId)} · ${exp.title} · ${exp.isCurrent ? "trabalho atual" : `trabalhou até ${exp.endedAt ? new Date(exp.endedAt).getUTCFullYear() : "—"}`}` }));
  const proofLabel = (value: string | undefined) => value === "VERIFIED" ? "Verificado" : value === "PENDING" ? "Em análise" : value === "REJECTED" ? "Não aprovado" : value === "MORE_INFO_REQUIRED" ? "Mais informações" : "Não enviado";
  const StatusIcon = content.icon;
  return <DashboardShell mode="consultant" title="Editar perfil" profileId={profile?.id}><div className="profile-management-stack"><ProfileCompleteness percent={completeness.percent} items={completeness.items}/><EditBox icon={<ImageIcon size={20}/>} title="Foto e capa" hint={`${profile?.user.image ? "Foto definida" : "Sem foto"} · ${profile?.coverImage ? "capa definida" : "sem capa"}`}><div className="edit-box-stack"><ProfileImageForm image={profile?.user.image} name={profile?.user.name || user.name || "Pessoa"} seed={user.id}/><ProfileCoverForm image={profile?.coverImage}/></div></EditBox>{profile && <ProfessionalProfileForm profile={profile} companies={companies} professions={professions} jobTitles={jobs.titles} areas={jobs.areas} messagePriceCents={messagePrice}/>}{profile && <EditBox icon={<MessageCircleHeart size={20}/>} title="Mensagem de boas-vindas" hint={welcome?.welcomeMessage ? "Ativa · aparece no chat quando o pagamento é confirmado" : "Opcional · aparece no chat quando o pagamento é confirmado"}><WelcomeMessageForm defaultValue={welcome?.welcomeMessage ?? ""}/></EditBox>}{profile && <EditBox icon={<Sparkles size={20}/>} title="Sobre a sua área" hint="Opcional · faixa salarial, prós e contras, em anônimo"><AreaInsightsForm salaryRange={welcome?.salaryRange ?? null} areaPro={welcome?.areaPro ?? null} areaCon={welcome?.areaCon ?? null}/></EditBox>}<EditBox id="verificacao" icon={<ShieldCheck size={20}/>} title="Verificação profissional" hint={content.label} open={status === VerificationStatus.REJECTED}><div className="profile-admin-grid"><section className={`panel verification-panel verification-${status.toLowerCase()}`}><div className="verification-heading"><span className="verification-icon"><StatusIcon size={25}/></span><div><span className="eyebrow">Verificação profissional</span><h2>{content.label}</h2></div></div><p>{content.copy}</p>{status === VerificationStatus.VERIFIED && <div className="verified-company"><Building2 size={20}/><span>O selo confirma a experiência analisada sem revelar dados privados.</span></div>}{proofRowsByExperience.length > 0 && <ul className="verification-experiences" aria-label="Comprovante de cada empresa">{proofRowsByExperience.map(({ exp, proof }) => <li key={exp.id}><div><strong>{companyName(exp.companyId)}</strong><small className="muted">{exp.title} · {exp.isCurrent ? "trabalho atual" : "experiência anterior"}</small>{proof?.status === "REJECTED" && proof.adminNotes && <small className="form-error">Motivo: {proof.adminNotes}</small>}</div><span className={`verification-chip is-${(proof?.status ?? "none").toLowerCase()}`}>{proofLabel(proof?.status)}</span></li>)}</ul>}{requestable.length > 0 ? <><h3 className="verification-form-title">Enviar comprovante{proofRowsByExperience.length > 1 ? " de uma empresa" : ""}</h3><VerificationRequestForm experiences={requestable}/></> : proofRowsByExperience.some(({ proof }) => proof?.status === "PENDING") && <p className="muted">Todas as empresas do seu perfil já têm comprovante enviado. Você recebe uma notificação com cada resultado.</p>}</section></div></EditBox></div></DashboardShell>;
}
