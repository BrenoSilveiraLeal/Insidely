import { FlashMessage } from "@/components/flash-message";
import Link from "next/link";
import { redirect } from "next/navigation";
import { reviewVerificationAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { getAdminData } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { verificationMethodLabel } from "@/lib/verification";

export const metadata = { title: "Verificações" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; ok?: string }> }) {
  await requireUser([Role.ADMIN]);
  const query = await searchParams;
  // Admin notifications link here with ?id=: go straight to that proof.
  if (query.id) redirect(`/admin/verificacoes/${encodeURIComponent(query.id)}`);
  const d = await getAdminData();
  // Requests with a file first; the demo profiles were seeded without one.
  const pending = [...d.pending].sort((a, b) => Number(b.documents.length > 0) - Number(a.documents.length > 0));
  return <DashboardShell mode="admin" title="Verificações">
    {query.ok && <FlashMessage key={query.ok}>{query.ok === "aprovado" ? "Comprovante aprovado. O perfil já mostra o vínculo verificado e o consultor foi avisado." : "Comprovante recusado. O consultor foi avisado e pode enviar outro."}</FlashMessage>}
    <div className="list">{pending.map((v) => <div className="list-row" key={v.id}>
      <div><strong>{v.professionalProfile?.user?.name ?? "Perfil indisponível"}</strong><p>{v.professionalProfile?.headline ?? "Perfil profissional"} · {v.professionalProfile?.experiences?.[0]?.company?.name ?? "Empresa não informada"}</p><span className="status">{verificationMethodLabel(v.method)}</span></div>
      <div className="verification-row-actions">
        {v.documents.length ? <Link className="button button-dark button-sm" href={`/admin/verificacoes/${v.id}`}>Ver comprovante</Link> : <span className="button button-ghost button-sm verification-no-file" aria-disabled="true" title="Esta solicitação não tem arquivo enviado">Sem arquivo</span>}
        <form action={reviewVerificationAction.bind(null, v.id, "VERIFIED")}><button className="button button-accent button-sm">Aprovar</button></form>
        <form action={reviewVerificationAction.bind(null, v.id, "REJECTED")}><button className="button button-ghost button-sm">Rejeitar</button></form>
      </div>
    </div>)}{!pending.length && <div className="panel">Fila vazia.</div>}</div>
  </DashboardShell>;
}
