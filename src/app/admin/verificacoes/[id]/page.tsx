import Link from "next/link";
import { notFound } from "next/navigation";
import { reviewVerificationAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { experiencePeriod } from "@/lib/experience-period";
import { VERIFICATION_METHODS, verificationMethodLabel } from "@/lib/verification";

export const metadata = { title: "Comprovante" };
export const dynamic = "force-dynamic";

// One proof of employment: what the consultant said it is, the company on the profile and the file
// itself (served through /api/verificacao/documento as a short-lived signed URL).
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireUser([Role.ADMIN]);
  const { id } = await params;
  const { data: verification } = await createSupabaseServiceClient().from("Verification")
    .select("id, method, status, createdAt, documents:VerificationDocument(id, originalName, mimeType), professionalProfile:ProfessionalProfile(id, headline, user:User(name), experiences:EmploymentExperience(id, title, isCurrent, startedAt, endedAt, company:Company(name)))")
    .eq("id", id).maybeSingle();
  if (!verification) notFound();
  const profile = Array.isArray(verification.professionalProfile) ? verification.professionalProfile[0] : verification.professionalProfile;
  const user = Array.isArray(profile?.user) ? profile.user[0] : profile?.user;
  // The experience the consultant chose to prove (Verification.experienceId); older proofs cover the main one.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: link } = await (createSupabaseServiceClient() as any).from("Verification").select("experienceId").eq("id", id).maybeSingle().then((result: any) => result, () => ({ data: null }));
  const experiences = (profile?.experiences ?? []) as { id: string; title: string; isCurrent: boolean; startedAt: string; endedAt: string | null; company: { name: string } | { name: string }[] | null }[];
  const experience = experiences.find((item) => item.id === link?.experienceId) ?? [...experiences].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.startedAt.localeCompare(a.startedAt))[0];
  const period = experience ? experiencePeriod({ isCurrent: experience.isCurrent, startedAt: experience.startedAt?.slice(0, 7), endedAt: experience.endedAt?.slice(0, 7) ?? null }) : null;
  const company = Array.isArray(experience?.company) ? experience.company[0] : experience?.company;
  const document = verification.documents?.[0];
  const href = document ? `/api/verificacao/documento/${document.id}` : null;
  const image = document?.mimeType?.startsWith("image/");
  const hint = VERIFICATION_METHODS.find((item) => item.value === verification.method)?.hint;
  return <DashboardShell mode="admin" title="Comprovante">
    <div className="verification-detail">
      <Link className="text-link" href="/admin/verificacoes">← Voltar para verificações</Link>
      <section className="panel verification-facts">
        <div><span className="eyebrow">Consultor</span><strong>{user?.name ?? "Perfil indisponível"}</strong><p className="muted">{profile?.headline}</p></div>
        <div><span className="eyebrow">Empresa declarada</span><strong>{company?.name ?? "Não informada"}</strong>{experience?.title && <p className="muted">{experience.title}</p>}{period && <p className="muted"><strong>{period}</strong></p>}</div>
        <div><span className="eyebrow">Comprovante escolhido</span><strong>{verificationMethodLabel(verification.method)}</strong>{hint && <p className="muted">{hint}</p>}</div>
        <div><span className="eyebrow">Enviado em</span><strong>{shortDate(parseDbDate(verification.createdAt))}</strong></div>
      </section>
      <section className="panel verification-document">
        {href ? <>
          {image
            ? <>{/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL of a private file, not for the image optimizer */}
              <img src={href} alt={`Comprovante enviado por ${user?.name ?? "consultor"}`}/></>
            : <iframe src={href} title={`Comprovante em PDF de ${user?.name ?? "consultor"}`}/>}
          <a className="text-link" href={href} target="_blank" rel="noreferrer">Abrir em outra aba · {document.originalName}</a>
        </> : <p className="muted">Esta solicitação não tem arquivo enviado.</p>}
      </section>
      {verification.status === "PENDING" ? <section className="panel verification-decision">
        <p>A foto ou o documento mostra o nome de <strong>{user?.name ?? "consultor"}</strong> e da empresa <strong>{company?.name ?? "declarada"}</strong>, é do tipo escolhido e combina com o período declarado{period ? <> (<strong>{period.toLowerCase()}</strong>)</> : null}?</p>
        <div className="verification-row-actions">
          <form action={reviewVerificationAction.bind(null, id, "VERIFIED")}><button className="button button-accent">Autorizar como verificado</button></form>
          <form action={reviewVerificationAction.bind(null, id, "REJECTED")} className="verification-reject"><input className="input" name="reason" maxLength={400} placeholder="Motivo da recusa (opcional, o consultor vê)"/><button className="button button-ghost">Rejeitar</button></form>
        </div>
      </section> : <p className="status">Esta solicitação já foi {verification.status === "VERIFIED" ? "aprovada" : "analisada"}.</p>}
    </div>
  </DashboardShell>;
}
