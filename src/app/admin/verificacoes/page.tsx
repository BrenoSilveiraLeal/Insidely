import Link from "next/link";
import { reviewVerificationAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate } from "@/lib/format";
import { getAdminData } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { verificationMethodLabel } from "@/lib/verification";

export const metadata = { title: "Verificações" };
export const dynamic = "force-dynamic";

// Proofs of employment waiting for review. The document is shown right here (image inline, PDF in a
// frame) through /api/verificacao/documento, which hands out a short-lived signed URL.
export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; ok?: string }> }) {
  await requireUser([Role.ADMIN]);
  const query = await searchParams;
  const data = await getAdminData();
  // Requests with a file first (the demo profiles were seeded without one), the one from a
  // notification at the very top.
  const pending = [...data.pending].sort((a, b) => Number(b.id === query.id) - Number(a.id === query.id) || Number(b.documents.length > 0) - Number(a.documents.length > 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
  const withFile = pending.filter((item) => item.documents.length > 0).length;
  return <DashboardShell mode="admin" title="Verificações">
    {query.ok && <p className="form-feedback" role="status">{query.ok === "aprovado" ? "Comprovante aprovado. O perfil já mostra o vínculo verificado e o consultor foi avisado." : "Comprovante recusado. O consultor foi avisado e pode enviar outro."}</p>}
    <div className="catalog-admin">
      <div className="catalog-counters">
        <div className="metric"><span>Comprovantes para analisar</span><strong>{withFile}</strong></div>
        <div className="metric"><span>Perfis sem arquivo enviado</span><strong>{pending.length - withFile}</strong></div>
      </div>
      {pending.map((item) => {
        const profile = item.professionalProfile;
        const document = item.documents[0];
        const href = document ? `/api/verificacao/documento/${document.id}` : null;
        const image = document?.mimeType?.startsWith("image/");
        return <article className={`panel verification-review${item.id === query.id ? " verification-review-focus" : ""}`} key={item.id} id={item.id}>
          <header className="catalog-request-head">
            <div><span className="eyebrow">{verificationMethodLabel(item.method)}</span><h2>{profile?.user?.name ?? "Perfil indisponível"}</h2><p className="muted">{profile?.headline ?? "Perfil profissional"} · empresa declarada: <strong>{profile?.experiences?.[0]?.company?.name ?? "não informada"}</strong></p></div>
            <span className="status">Enviado em {shortDate(parseDbDate(String(item.createdAt)))}</span>
          </header>
          {href ? <div className="verification-document">
            {image ? <a href={href} target="_blank" rel="noreferrer" title="Abrir em tamanho real">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL of a private file, not for the image optimizer */}
              <img src={href} alt={`Comprovante enviado por ${profile?.user?.name ?? "consultor"}`}/>
            </a>
              : <iframe src={href} title={`Comprovante em PDF de ${profile?.user?.name ?? "consultor"}`}/>}
            <a className="text-link" href={href} target="_blank" rel="noreferrer">Abrir {image ? "imagem" : "PDF"} em outra aba · {document.originalName}</a>
          </div> : <p className="muted">Nenhum arquivo foi enviado nesta solicitação (perfil de demonstração).</p>}
          <p className="muted">Confira se o nome da pessoa e o nome da empresa aparecem no documento e batem com o perfil.</p>
          <div className="catalog-actions">
            <form action={reviewVerificationAction.bind(null, item.id, "VERIFIED")} className="catalog-action"><strong>O documento confere</strong><p className="muted">O perfil passa a mostrar “Vínculo verificado”.</p><button className="button button-accent button-sm">Aprovar</button></form>
            <form action={reviewVerificationAction.bind(null, item.id, "REJECTED")} className="catalog-action catalog-action-reject"><strong>Não confere</strong><label className="field"><span>Motivo (o consultor vê)</span><textarea className="textarea" name="reason" maxLength={400} placeholder="Ex.: o nome da empresa não aparece no documento."/></label><button className="button button-ghost button-sm">Rejeitar</button></form>
          </div>
          {profile?.id && <Link className="text-link" href={`/profissional/${profile.id}`} target="_blank">Ver perfil público</Link>}
        </article>;
      })}
      {!pending.length && <section className="panel catalog-empty"><span className="catalog-empty-icon" aria-hidden="true">✓</span><h2>Fila vazia</h2><p className="muted">Nenhum comprovante aguardando análise. Quando um consultor enviar, você recebe uma notificação no sino.</p></section>}
    </div>
  </DashboardShell>;
}
