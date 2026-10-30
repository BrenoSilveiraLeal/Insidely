import Link from "next/link";
import { assignCaseAction } from "@/app/actions";

// Opening a support request or report goes through its case page, where the admin answers the
// person. An open case nobody took yet is taken first ("Assumir e abrir"), so the owner is recorded.
export function CaseOpenButton({ reportId, open, owner }: { reportId: string; open: boolean; owner: { name: string; mine: boolean } | null }) {
  const href = `/admin/casos/relato/${reportId}`;
  if (!open) return <Link className="button button-ghost button-sm" href={href}>Ver histórico</Link>;
  if (!owner) return <form action={assignCaseAction.bind(null, `report:${reportId}`, href)}><button className="button button-dark button-sm">Assumir e abrir</button></form>;
  return <span className="case-open-owned"><small className="muted">{owner.mine ? "Seu caso" : `Com ${owner.name}`}</small><Link className="button button-dark button-sm" href={href}>{owner.mine ? "Responder" : "Abrir"}</Link></span>;
}
