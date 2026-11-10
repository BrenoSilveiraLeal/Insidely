import Link from "next/link";
import { Ban, ChevronRight, Search, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { SUSPENSION_DAYS_BY_ROUND, WARNINGS_PER_SUSPENSION } from "@/lib/enforcement-policy";
import { parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { decideAppealAction } from "@/app/actions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Advertências e suspensões" };
export const dynamic = "force-dynamic";

type Account = { id: string; name: string; email: string; role: string; suspendedAt: string | null; suspendedUntil: string | null };
type Tally = { warnings: number; suspensions: number };

const duration = (days: number) => days === 7 ? "1 semana" : days === 30 ? "1 mês" : `${days} dias`;

// The ladder shown at the top, built from the same rules the automatic enforcement uses.
const steps = [
  ...SUSPENSION_DAYS_BY_ROUND.map((days, index) => ({ at: WARNINGS_PER_SUSPENSION * (index + 1), title: `${index + 1}ª suspensão`, detail: `${duration(days)} sem acesso. Depois o acesso volta sozinho.` })),
  { at: WARNINGS_PER_SUSPENSION * (SUSPENSION_DAYS_BY_ROUND.length + 1), title: "Banimento", detail: "A conta fica bloqueada de forma permanente." },
];

function accountState(account: Account) {
  if (!account.suspendedAt) return { kind: "active" as const, label: "Ativa" };
  if (!account.suspendedUntil) return { kind: "banned" as const, label: "Banida" };
  const until = parseDbDate(account.suspendedUntil);
  return until > new Date() ? { kind: "suspended" as const, label: `Suspensa até ${shortDate(until)}` } : { kind: "active" as const, label: "Ativa" };
}

// Support staff see every account that has a warning or a suspension, and can look up any other account
// by name or e-mail (never CPF). Admin and support accounts are not listed. Warnings and suspensions are
// given on the account page; the suspensions and the ban follow automatically from the warnings.
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; recurso?: string }> }) {
  const staff = await requireUser([Role.ADMIN, Role.SUPPORT]);
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const columns = "id, name, email, role, suspendedAt, suspendedUntil";

  const [{ data: warningRows }, { data: suspensionRows }] = await Promise.all([
    supabase.from("AccountWarning").select("userId").limit(5000),
    supabase.from("AccountSuspension").select("userId").limit(5000),
  ]);
  const tally = new Map<string, Tally>();
  const bump = (userId: string, key: keyof Tally) => { const row = tally.get(userId) ?? { warnings: 0, suspensions: 0 }; row[key]++; tally.set(userId, row); };
  for (const row of (warningRows ?? []) as { userId: string }[]) bump(row.userId, "warnings");
  for (const row of (suspensionRows ?? []) as { userId: string }[]) bump(row.userId, "suspensions");

  let accounts: Account[] = [];
  if (q.length >= 3) {
    const term = q.replace(/[%,()]/g, " ");
    const { data } = await supabase.from("User").select(columns).in("role", ["USER", "CONSULTANT"]).not("email", "like", "deleted+%").not("email", "like", "merged+%").or(`name.ilike.%${term}%,email.ilike.%${term}%`).order("name").limit(25);
    accounts = (data ?? []) as Account[];
  } else if (tally.size) {
    const { data } = await supabase.from("User").select(columns).in("id", [...tally.keys()]).in("role", ["USER", "CONSULTANT"]);
    // Most serious first: banned, suspended, then by number of warnings.
    const weight = (account: Account) => ({ banned: 2, suspended: 1, active: 0 })[accountState(account).kind];
    accounts = ((data ?? []) as Account[]).sort((a, b) => weight(b) - weight(a) || (tally.get(b.id)?.warnings ?? 0) - (tally.get(a.id)?.warnings ?? 0) || a.name.localeCompare(b.name));
  }

  // Appeals waiting for a decision (lib/appeals.ts), oldest first.
  const { data: appealRows } = await supabase.from("SanctionAppeal").select("id, userId, kind, sanctionReason, sanctionAt, reason, createdAt, user:User!SanctionAppeal_userId_fkey(name, email)").eq("status", "PENDING").order("createdAt").limit(50);
  type AppealRow = { id: string; userId: string; kind: "WARNING" | "SUSPENSION"; sanctionReason: string; sanctionAt: string; reason: string; createdAt: string; user: { name: string; email: string } | { name: string; email: string }[] | null };
  const pendingAppeals = (appealRows ?? []) as AppealRow[];
  return <DashboardShell mode={staff.role === Role.ADMIN ? "admin" : "support"} title="Advertências e suspensões">
    {params.recurso === "decidido" && <p className="form-feedback" role="status">Recurso decidido. A pessoa foi avisada por notificação.</p>}
    <section className="panel form-stack" id="recursos">
      <span className="eyebrow">Recursos pendentes</span>
      <h2>{pendingAppeals.length ? `${pendingAppeals.length} ${pendingAppeals.length === 1 ? "recurso para analisar" : "recursos para analisar"}` : "Nenhum recurso para analisar."}</h2>
      <p className="muted">Aceitar remove a advertência (ela deixa de contar para suspensão) ou a suspensão (se estiver valendo, a conta volta na hora). Recusar mantém. A pessoa é avisada nos dois casos.</p>
      {pendingAppeals.map((appeal) => { const person = Array.isArray(appeal.user) ? appeal.user[0] : appeal.user; return <article className="appeal-review" key={appeal.id}>
        <div className="appeal-review-head"><strong><Link className="text-link" href={`/admin/sancoes/${appeal.userId}`}>{person?.name ?? "Conta"}</Link></strong><small className="muted">{appeal.kind === "WARNING" ? "Advertência" : "Suspensão"} de {shortDate(parseDbDate(appeal.sanctionAt))} · recurso em {shortDate(parseDbDate(appeal.createdAt))}</small></div>
        <p className="muted"><strong>Motivo da {appeal.kind === "WARNING" ? "advertência" : "suspensão"}:</strong> {appeal.sanctionReason}</p>
        <p><strong>Recurso:</strong> “{appeal.reason}”</p>
        <form action={decideAppealAction.bind(null, appeal.id)} className="form-stack"><textarea className="textarea" name="note" rows={2} maxLength={500} aria-label="Resposta para a pessoa" placeholder="Resposta para a pessoa (opcional, aparece na notificação)."/><div className="booking-option-actions"><button className="button button-accent button-sm" name="decision" value="accept">Aceitar e remover</button><button className="button button-ghost button-sm" name="decision" value="reject">Manter</button></div></form>
      </article>; })}
    </section>
    <section className="panel sanctions-rules" aria-labelledby="sanctions-rules-title">
      <div className="sanctions-rules-head">
        <h2 id="sanctions-rules-title">Como funciona</h2>
        <p className="muted">As advertências vêm de vocês ou, automaticamente, do chat: mensagem bloqueada por contato, pagamento por fora ou ofensa gera no máximo uma advertência a cada 24 horas. A cada {WARNINGS_PER_SUSPENSION}, o sistema suspende a conta sozinho e, no fim do prazo, devolve o acesso. A pessoa pode recorrer de cada advertência e suspensão; os recursos aparecem acima.</p>
      </div>
      <ol className="sanctions-ladder">
        {steps.map((step, index) => <li key={step.title} className={index === steps.length - 1 ? "is-ban" : undefined}>
          <span className="sanctions-ladder-count">{step.at} advertências</span>
          <span className="sanctions-ladder-dots" aria-hidden="true">{Array.from({ length: WARNINGS_PER_SUSPENSION }, (_, dot) => <i key={dot} />)}</span>
          <strong>{index === steps.length - 1 ? <Ban size={16} aria-hidden="true" /> : <ShieldAlert size={16} aria-hidden="true" />}{step.title}</strong>
          <p>{step.detail}</p>
        </li>)}
      </ol>
    </section>

    <section className="sanctions-list" aria-labelledby="sanctions-list-title">
      <div className="sanctions-list-head">
        <h2 id="sanctions-list-title">{q.length >= 3 ? `Resultado para “${q}”` : "Contas com advertência ou suspensão"}</h2>
        <form className="sanctions-search" role="search">
          <Search size={16} aria-hidden="true" />
          <input className="input" name="q" defaultValue={q} minLength={3} placeholder="Buscar por nome ou e-mail" aria-label="Buscar conta por nome ou e-mail (mínimo 3 letras)" />
          <button className="button button-dark button-sm">Buscar</button>
          {q && <Link className="text-link" href="/admin/sancoes">Limpar</Link>}
        </form>
      </div>

      {accounts.length ? <ul className="sanctions-rows">
        {accounts.map((account) => {
          const counts = tally.get(account.id) ?? { warnings: 0, suspensions: 0 };
          const state = accountState(account);
          const toNext = WARNINGS_PER_SUSPENSION - (counts.warnings % WARNINGS_PER_SUSPENSION);
          return <li key={account.id}><Link className="sanctions-row" href={`/admin/sancoes/${account.id}`}>
            <span className="sanctions-row-who"><strong>{account.name}</strong><span>{account.email} · {account.role === "CONSULTANT" ? "Consultor" : "Cliente"}</span></span>
            <span className="sanctions-row-counts">
              <span><TriangleAlert size={15} aria-hidden="true" />{counts.warnings} {counts.warnings === 1 ? "advertência" : "advertências"}</span>
              <span><ShieldAlert size={15} aria-hidden="true" />{counts.suspensions} {counts.suspensions === 1 ? "suspensão" : "suspensões"}</span>
            </span>
            <span className="sanctions-row-state">
              <span className={`sanctions-chip is-${state.kind}`}>{state.label}</span>
              {state.kind !== "banned" && <small>{toNext} para a próxima etapa</small>}
            </span>
            <ChevronRight className="sanctions-row-go" size={18} aria-hidden="true" />
          </Link></li>;
        })}
      </ul> : <div className="sanctions-empty">
        <ShieldCheck size={28} aria-hidden="true" />
        <div>
          <strong>{q.length >= 3 ? "Nenhuma conta encontrada" : q ? "Digite pelo menos 3 letras" : "Nenhuma conta com advertência ou suspensão"}</strong>
          <p className="muted">{q.length >= 3 ? "Confira o nome ou o e-mail. Contas do suporte e da administração não aparecem aqui." : q ? "A busca usa o nome ou o e-mail da conta." : "Quando alguém receber uma advertência, a conta aparece aqui com o número de advertências, de suspensões e a situação atual."}</p>
        </div>
      </div>}
    </section>
  </DashboardShell>;
}
