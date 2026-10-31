import { featureDecisionStoryAction, reviewDecisionStoryAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { paginate } from "@/lib/paginate";
import { PaginationControls } from "@/components/pagination-controls";
import { HOME_STORY_LIMIT } from "@/lib/story-limits";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Histórias" };
export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

type Row = { bookingId: string; story: string; status: string; createdAt: string; featuredAt?: string | null };

const STATUS: Record<string, { label: string; tone: string }> = {
  APPROVED: { label: "Aceita · aparece no perfil", tone: "is-answered" },
  REJECTED: { label: "Rejeitada", tone: "is-closed" },
  PENDING: { label: "Nova · aguardando análise", tone: "" },
};

// "Decidi!" stories the customers allowed to publish. New → accept or reject. Accepted stories show
// on the consultant's profile, and up to HOME_STORY_LIMIT of them are "no ar" (home page carousel).
export default async function Page({ searchParams }: { searchParams: Promise<{ erro?: string; page?: string }> }) {
  await requireUser([Role.ADMIN]);
  const { erro, page: pageParam } = await searchParams;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const query = (columns: string) => supabase.from("DecisionStory").select(columns).eq("allowPublish", true).order("createdAt", { ascending: false }).limit(1000);
  // featuredAt arrives with migration 20261101098000; until then the home page shows the latest three.
  let result = await query("bookingId, story, status, createdAt, featuredAt");
  const canFeature = !result.error;
  if (!canFeature) result = await query("bookingId, story, status, createdAt");
  const rows = (result.data ?? []) as Row[];
  const featuredCount = rows.filter((row) => row.featuredAt).length;
  const full = featuredCount >= HOME_STORY_LIMIT;
  const shown = paginate(rows, pageParam, PAGE_SIZE);
  return <DashboardShell mode="admin" title="Histórias">
    {erro === "limite" && <p className="form-error stories-limit" role="alert">Só podem ficar {HOME_STORY_LIMIT} histórias no ar ao mesmo tempo. Tire uma do ar para colocar esta.</p>}
    <div className="stories-admin-head">
      <p className="muted">Histórias aceitas aparecem no perfil do consultor. Até {HOME_STORY_LIMIT} delas ficam no ar, no carrossel da página inicial.</p>
      {canFeature ? <span className={`support-case-state${full ? " is-urgent" : " is-answered"}`}>No ar: {featuredCount} de {HOME_STORY_LIMIT}</span> : <span className="support-case-state">Destaque na página inicial aguardando atualização do banco</span>}
    </div>
    <div className="list">{shown.items.map((row) => {
      const status = STATUS[row.status] ?? STATUS.PENDING;
      return <div className="list-row story-admin-row" key={row.bookingId}>
        <div>
          <p>“{row.story}”</p>
          <div className="story-admin-meta"><span className={`support-case-state ${status.tone}`}>{status.label}</span>{row.featuredAt && <span className="support-case-state is-featured">No ar · página inicial</span>}<small className="muted">{shortDate(parseDbDate(row.createdAt))}</small></div>
        </div>
        <div className="verification-row-actions">
          {row.status === "PENDING" && <><form action={reviewDecisionStoryAction.bind(null, row.bookingId, "APPROVED")}><button className="button button-accent button-sm">Aceitar</button></form><form action={reviewDecisionStoryAction.bind(null, row.bookingId, "REJECTED")}><button className="button button-ghost button-sm">Rejeitar</button></form></>}
          {row.status === "APPROVED" && canFeature && (row.featuredAt
            ? <form action={featureDecisionStoryAction.bind(null, row.bookingId, false)}><button className="button button-ghost button-sm">Tirar do ar</button></form>
            : <form action={featureDecisionStoryAction.bind(null, row.bookingId, true)}><button className="button button-dark button-sm">Colocar no ar</button></form>)}
          {row.status === "REJECTED" && <form action={reviewDecisionStoryAction.bind(null, row.bookingId, "PENDING")}><button className="story-reconsider">Reconsiderar</button></form>}
        </div>
      </div>;
    })}{!rows.length && <div className="panel">Nenhuma história autorizada para publicação ainda.</div>}</div>
    <PaginationControls page={shown.page} total={shown.total} pageSize={PAGE_SIZE} basePath="/admin/historias"/>
  </DashboardShell>;
}
