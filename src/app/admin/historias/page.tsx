import { reviewDecisionStoryAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Histórias" };
export const dynamic = "force-dynamic";

// "Decidi!" stories the customers allowed to publish; approved ones appear on the home page.
export default async function Page() {
  await requireUser([Role.ADMIN]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (createSupabaseServiceClient() as any).from("DecisionStory").select("bookingId, story, status, createdAt").eq("allowPublish", true).order("createdAt", { ascending: false }).limit(100);
  const rows = (data ?? []) as { bookingId: string; story: string; status: string; createdAt: string }[];
  return <DashboardShell mode="admin" title="Histórias">
    <div className="list">{rows.map((row) => <div className="list-row" key={row.bookingId}><div><p>“{row.story}”</p><small className="muted">{shortDate(parseDbDate(row.createdAt))} · {row.status === "APPROVED" ? "Publicada na página inicial" : row.status === "REJECTED" ? "Não publicada" : "Aguardando aprovação"}</small></div><div className="verification-row-actions">{row.status !== "APPROVED" && <form action={reviewDecisionStoryAction.bind(null, row.bookingId, "APPROVED")}><button className="button button-accent button-sm">Publicar</button></form>}{row.status !== "REJECTED" && <form action={reviewDecisionStoryAction.bind(null, row.bookingId, "REJECTED")}><button className="button button-ghost button-sm">{row.status === "APPROVED" ? "Tirar do ar" : "Não publicar"}</button></form>}</div></div>)}{!rows.length && <div className="panel">Nenhuma história autorizada para publicação ainda.</div>}</div>
  </DashboardShell>;
}
