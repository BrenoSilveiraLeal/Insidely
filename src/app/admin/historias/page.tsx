import { featureDecisionStoryAction, reviewDecisionStoryAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { FlashMessage } from "@/components/flash-message";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { HOME_STORY_LIMIT } from "@/lib/story-limits";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Histórias" };
export const dynamic = "force-dynamic";

type Row = { bookingId: string; story: string; status: string; createdAt: string; featuredAt?: string | null };

const STATUS: Record<string, { label: string; tone: string }> = {
  APPROVED: { label: "Publicada no perfil", tone: "is-answered" },
  REJECTED: { label: "Não publicada", tone: "is-closed" },
  PENDING: { label: "Aguardando análise", tone: "" },
};

// "Decidi!" stories the customers allowed to publish. Publishing shows a story on the consultant's
// profile; up to HOME_STORY_LIMIT published stories are also featured in the home page carousel.
export default async function Page({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await requireUser([Role.ADMIN]);
  const { erro } = await searchParams;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const query = (columns: string) => supabase.from("DecisionStory").select(columns).eq("allowPublish", true).order("createdAt", { ascending: false }).limit(100);
  // featuredAt arrives with migration 20261101098000; until then the home page shows the latest four.
  let result = await query("bookingId, story, status, createdAt, featuredAt");
  const canFeature = !result.error;
  if (!canFeature) result = await query("bookingId, story, status, createdAt");
  const rows = (result.data ?? []) as Row[];
  const featuredCount = rows.filter((row) => row.featuredAt).length;
  const full = featuredCount >= HOME_STORY_LIMIT;
  return <DashboardShell mode="admin" title="Histórias">
    {erro === "limite" && <FlashMessage param="erro">A página inicial já tem {HOME_STORY_LIMIT} histórias. Tire uma para colocar outra.</FlashMessage>}
    <div className="stories-admin-head">
      <p className="muted">Publicar mostra a história no perfil do consultor. Até {HOME_STORY_LIMIT} histórias publicadas também aparecem no carrossel da página inicial.</p>
      {canFeature ? <span className={`support-case-state${full ? " is-urgent" : " is-answered"}`}>Página inicial: {featuredCount} de {HOME_STORY_LIMIT}</span> : <span className="support-case-state">Destaque na página inicial aguardando atualização do banco</span>}
    </div>
    <div className="list">{rows.map((row) => {
      const status = STATUS[row.status] ?? STATUS.PENDING;
      return <div className="list-row story-admin-row" key={row.bookingId}>
        <div>
          <p>“{row.story}”</p>
          <div className="story-admin-meta"><span className={`support-case-state ${status.tone}`}>{status.label}</span>{row.featuredAt && <span className="support-case-state is-featured">Na página inicial</span>}<small className="muted">{shortDate(parseDbDate(row.createdAt))}</small></div>
        </div>
        <div className="verification-row-actions">
          {row.status === "APPROVED" && canFeature && (row.featuredAt
            ? <form action={featureDecisionStoryAction.bind(null, row.bookingId, false)}><button className="button button-ghost button-sm">Tirar da página inicial</button></form>
            : <form action={featureDecisionStoryAction.bind(null, row.bookingId, true)}><button className="button button-dark button-sm" disabled={full} title={full ? `Já há ${HOME_STORY_LIMIT} na página inicial: tire uma primeiro` : undefined}>Pôr na página inicial</button></form>)}
          {row.status !== "APPROVED" && <form action={reviewDecisionStoryAction.bind(null, row.bookingId, "APPROVED")}><button className="button button-accent button-sm">Publicar</button></form>}
          {row.status !== "REJECTED" && <form action={reviewDecisionStoryAction.bind(null, row.bookingId, "REJECTED")}><button className="button button-ghost button-sm">{row.status === "APPROVED" ? "Tirar do ar" : "Não publicar"}</button></form>}
        </div>
      </div>;
    })}{!rows.length && <div className="panel">Nenhuma história autorizada para publicação ainda.</div>}</div>
  </DashboardShell>;
}
