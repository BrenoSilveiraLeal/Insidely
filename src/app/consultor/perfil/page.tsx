import { ProfileCompleteness } from "@/components/profile-completeness";
import { getProfileCompleteness } from "@/lib/consultant-insights";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getPublicCompanies, getPublicProfessions, getConsultantDashboard } from "@/lib/queries";
import { Role, VerificationStatus } from "@/lib/domain";
import { BadgeCheck, Building2, CircleAlert, Clock3 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProfessionalProfileForm, VerificationRequestForm, WelcomeMessageForm, AreaInsightsForm } from "@/components/profile-management";
import { ProfileImageForm } from "@/components/profile-image-form";
import { ProfileCoverForm } from "@/components/profile-cover-form";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Perfil e verificação" };
export const dynamic = "force-dynamic";
const statusContent = { NOT_SUBMITTED: { label: "Vínculo não verificado", copy: "Seu perfil aparece como “não verificado”. Envie um comprovante de que trabalha (ou trabalhou) na empresa informada: crachá, folha de ponto ou holerite, carteira de trabalho digital ou outro documento.", icon: CircleAlert }, PENDING: { label: "Comprovante em análise", copy: "Seu comprovante chegou à equipe da Insidely. Você recebe uma notificação com o resultado.", icon: Clock3 }, VERIFIED: { label: "Vínculo verificado", copy: "Seu perfil mostra que o vínculo com a empresa foi verificado pela Insidely.", icon: BadgeCheck }, REJECTED: { label: "Comprovante não aprovado", copy: "Seu perfil continua como “não verificado”. Você pode enviar outro comprovante abaixo.", icon: CircleAlert }, MORE_INFO_REQUIRED: { label: "Precisamos de mais informações", copy: "Envie um novo comprovante.", icon: CircleAlert } } as const;

export default async function Page() {
  const user = await requireUser([Role.CONSULTANT]);
  const [profile, companies, professions] = await Promise.all([getConsultantDashboard(user.id), getPublicCompanies(), getPublicProfessions()]);
  const status = profile?.verificationStatus ?? VerificationStatus.NOT_SUBMITTED;
  const content = statusContent[status as keyof typeof statusContent] ?? statusContent.NOT_SUBMITTED;
  const completeness = await getProfileCompleteness(user.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: welcome } = await (createSupabaseServiceClient() as any).from("ProfessionalProfile").select("welcomeMessage, salaryRange, areaPro, areaCon").eq("userId", user.id).maybeSingle();
  // Verification.adminNotes is written by reviewVerificationAction when an admin rejects with a reason.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lastRejection } = status === VerificationStatus.REJECTED && profile?.id ? await (createSupabaseServiceClient() as any).from("Verification").select("adminNotes").eq("professionalProfileId", profile.id).eq("status", "REJECTED").order("reviewedAt", { ascending: false }).limit(1).maybeSingle() : { data: null };
  const rejectionReason: string | null = lastRejection?.adminNotes ?? null;
  const StatusIcon = content.icon;
  const canRequest = status !== VerificationStatus.PENDING && status !== VerificationStatus.VERIFIED;
  return <DashboardShell mode="consultant" title="Perfil e verificação" profileId={profile?.id}><div className="profile-management-stack"><ProfileCompleteness percent={completeness.percent} items={completeness.items}/><ProfileImageForm image={profile?.user.image} name={profile?.user.name || user.name || "Pessoa"} seed={user.id}/><ProfileCoverForm image={profile?.coverImage}/>{profile && <ProfessionalProfileForm profile={profile} companies={companies} professions={professions}/>}{profile && <WelcomeMessageForm defaultValue={welcome?.welcomeMessage ?? ""}/>}{profile && <AreaInsightsForm salaryRange={welcome?.salaryRange ?? null} areaPro={welcome?.areaPro ?? null} areaCon={welcome?.areaCon ?? null}/>}{process.env.STRIPE_SECRET_KEY && <section className="panel"><span className="eyebrow">Recebimentos</span><h2>Ganhos demonstrativos</h2><p className="muted">Nesta versão acadêmica os pagamentos são simulados: o valor de cada conversa concluída aparece em Ganhos, sem movimentar dinheiro.</p></section>}<div className="profile-admin-grid"><div className="profile-left-column"></div><section className={`panel verification-panel verification-${status.toLowerCase()}`} id="verificacao"><div className="verification-heading"><span className="verification-icon"><StatusIcon size={25}/></span><div><span className="eyebrow">Verificação profissional</span><h2>{content.label}</h2></div></div><p>{content.copy}</p>{status === VerificationStatus.REJECTED && rejectionReason && <p className="form-error" role="note"><strong>Motivo informado pela equipe:</strong> {rejectionReason}</p>}{canRequest && <VerificationRequestForm/>}{status === VerificationStatus.PENDING && <div className="verification-progress"><span/><span/><span/><small>Solicitação recebida</small><small>Análise da experiência</small><small>Resultado no perfil</small></div>}{status === VerificationStatus.VERIFIED && <div className="verified-company"><Building2 size={20}/><span>O selo confirma a experiência analisada sem revelar dados privados.</span></div>}</section></div></div></DashboardShell>;
}
