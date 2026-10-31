import { FlashMessage } from "@/components/flash-message";
import Link from "next/link";
import { redirect } from "next/navigation";
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
      <div><strong>{v.professionalProfile?.user?.name ?? "Perfil indisponível"}</strong><p>{v.professionalProfile?.headline ?? "Perfil profissional"} · {(v.professionalProfile?.experiences?.find((exp) => exp.id === (v as { experienceId?: string | null }).experienceId) ?? v.professionalProfile?.experiences?.[0])?.company?.name ?? "Empresa não informada"}</p><span className="status">{verificationMethodLabel(v.method)}</span></div>
      <div className="verification-row-actions">
        {/* Approving or rejecting happens on the proof page, after looking at the file. */}
        {v.documents.length ? <Link className="button button-dark button-sm" href={`/admin/verificacoes/${v.id}`}>Ver comprovante</Link> : <Link className="button button-ghost button-sm verification-no-file" href={`/admin/verificacoes/${v.id}`} title="Esta solicitação não tem arquivo enviado. Abra para recusar.">Sem arquivo</Link>}
      </div>
    </div>)}{!pending.length && <div className="panel">Fila vazia.</div>}</div>
  </DashboardShell>;
}
