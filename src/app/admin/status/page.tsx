import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { appEmailConfigured, smtpConfigured } from "@/lib/email";
import { parseDbDate, shortDate } from "@/lib/format";
import { checkGoogleMeet } from "@/lib/google-meet";
import { checkStripe } from "@/lib/stripe";
import { calendarLastSuccessAt, checkGoogleCalendarLinks, GOOGLE_CALENDAR_ERRORS } from "@/lib/google-calendar-link";
import { imageModerationConfigured } from "@/lib/image-moderation";
import { explainError } from "@/lib/error-text";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Status do sistema" };
export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function measureDatabase(supabase: any) {
  const started = Date.now();
  const { error } = await supabase.from("User").select("id", { count: "exact", head: true });
  return { error, ms: Date.now() - started };
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const minutesSince = (date: Date) => Math.round((Date.now() - date.getTime()) / 60_000);

// Health of the pieces the platform depends on: database, Google Meet, payments, e-mail and scheduled jobs.
const RUN_LABELS: Record<string, string> = {
  reminded: "lembrete(s) enviado(s)", reviewPrompts: "pedido(s) de avaliação", closedRooms: "sala(s) encerrada(s)", noShows: "ausência(s) registrada(s)",
  resumedPauses: "pausa(s) encerrada(s)", unreadEmails: "e-mail(s) de mensagem não lida", pushes: "notificação(ões) push",
  released: "repasse(s) liberado(s)", simulationReleased: "repasse(s) de demonstração liberado(s)", expired: "agendamento(s) expirado(s)",
  retention: "registro(s) antigo(s) apagado(s)", pixWaiting: "consultor(es) com valor retido aguardando chave Pix", suspicious: "conta(s) suspeita(s) sinalizada(s)", decisionPrompts: "aviso(s) de decisão pendente", emptyAgendas: "aviso(s) de agenda vazia",
};

// Turns a cron run's JSON detail into a short sentence; empty when the run had nothing to do.
function describeRun(detail: string | null) {
  if (!detail) return "";
  let data: Record<string, unknown>;
  try { data = JSON.parse(detail); } catch { return detail.slice(0, 160); }
  const count = (value: unknown): number => typeof value === "number" ? value : value && typeof value === "object" ? Object.values(value).reduce<number>((sum, item) => sum + count(item), 0) : 0;
  return Object.entries(RUN_LABELS).map(([key, label]) => [count(data[key]), label] as const).filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`).join(" · ");
}

export default async function Page() {
  await requireUser([Role.ADMIN]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { error: dbError, ms: dbMs } = await measureDatabase(supabase);
  // The 5-minute job writes ~300 rows a day, so the daily run is fetched on its own: a shared
  // "latest 60" list would push it out within five hours and the page would call it missing.
  const [calendarSuccessAt, calendarLinks, meet, { data: runs }, { data: dailyRuns }, { count: fallbackRooms }, { data: errors }] = await Promise.all([
    calendarLastSuccessAt(supabase),
    checkGoogleCalendarLinks(supabase),
    checkGoogleMeet(),
    supabase.from("CronRun").select("job, ok, detail, createdAt").order("createdAt", { ascending: false }).limit(60),
    supabase.from("CronRun").select("job, ok, detail, createdAt").eq("job", "daily").order("createdAt", { ascending: false }).limit(5),
    supabase.from("Booking").select("id", { count: "exact", head: true }).like("meetingUrl", "https://meet.jit.si%").gte("startsAt", daysAgo(7)),
    supabase.from("ErrorEvent").select("path, routeType, message, createdAt").gte("createdAt", daysAgo(7)).order("createdAt", { ascending: false }).limit(30),
  ]);
  type Run = { job: string; ok: boolean; detail: string | null; createdAt: string };
  const seen = new Set<string>();
  const runRows = [...((runs ?? []) as Run[]), ...((dailyRuns ?? []) as Run[])]
    .filter((row) => { const key = `${row.job}:${row.createdAt}`; if (seen.has(key)) return false; seen.add(key); return true; })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const notableRuns = runRows.filter((row) => !row.ok || describeRun(row.detail)).slice(0, 15);
  const jobCheck = (job: string, label: string, maxMinutes: number): Check => {
    const last = runRows.find((row) => row.job === job);
    if (!last) return { name: label, ok: false, message: job === "daily" ? "Ainda não há execução registrada. Ela roda todo dia às 1h (horário de Brasília); se continuar assim amanhã, confira os Cron Jobs na Vercel." : "Ainda não há execução registrada." };
    const minutes = minutesSince(parseDbDate(last.createdAt));
    const late = minutes > maxMinutes;
    return { name: label, ok: last.ok && !late, message: `${last.ok ? "Última execução bem-sucedida" : "Última execução FALHOU"} há ${minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`}${late ? " — está atrasada" : ""}.` };
  };
  // Same problem many times is one line, explained in plain words (lib/error-text.ts).
  const errorGroups = [...((errors ?? []) as { path: string; routeType: string; message: string; createdAt: string }[]).reduce((groups, row) => {
    const text = explainError(row);
    const key = `${text.area}|${text.what}`;
    const group = groups.get(key);
    if (group) group.count++; else groups.set(key, { key, text, routeType: row.routeType, last: row.createdAt, count: 1 });
    return groups;
  }, new Map<string, { key: string; text: ReturnType<typeof explainError>; routeType: string; last: string; count: number }>()).values()]
    // Resolved: for the Google Agenda, a sync worked after the last error; otherwise it has not
    // happened again for a day. Pending ones come first.
    .map((group) => {
      const lastAt = parseDbDate(group.last).getTime();
      const calendar = GOOGLE_CALENDAR_ERRORS.includes(group.routeType);
      const resolved = calendar ? Boolean(calendarSuccessAt && new Date(calendarSuccessAt).getTime() > lastAt) : minutesSince(parseDbDate(group.last)) > 24 * 60;
      return { ...group, resolved, resolvedWhy: calendar ? "a sincronização voltou a funcionar depois disso" : "não voltou a acontecer nas últimas 24 h" };
    })
    .sort((a, b) => Number(a.resolved) - Number(b.resolved));
  const checks: Check[] = [
    { name: "Banco de dados", ok: !dbError, message: dbError ? `Erro: ${dbError.message}` : `Respondendo (${dbMs} ms).` },
    { name: "Google Meet", ok: meet.ok, message: meet.message + (fallbackRooms ? ` ${fallbackRooms} sala(s) usaram o Jitsi nos últimos 7 dias.` : "") },
    { name: "Google Agenda", ...calendarLinks },
    { name: "Pagamentos (Stripe)", ...checkStripe() },
    { name: "Envio de e-mails", ok: appEmailConfigured(), message: appEmailConfigured() ? (smtpConfigured() ? "Configurado via SMTP (Gmail)." : "Configurado via Resend.") : "Nenhum provedor configurado: e-mails não são enviados." },
    { name: "Moderação de fotos", ok: imageModerationConfigured(), message: imageModerationConfigured() ? "Fotos de perfil e capas são verificadas automaticamente antes de serem publicadas." : "DESLIGADA: falta a variável OPENAI_API_KEY na Vercel. Sem ela, qualquer foto é aceita." },
    jobCheck("reminders", "Tarefa de 5 minutos (lembretes, salas, avisos)", 20),
    jobCheck("daily", "Tarefa diária (expirações, retenção, avisos)", 26 * 60),
  ];
  return <DashboardShell mode="admin" title="Status do sistema">
    <div className="list">{checks.map((check) => <div className="list-row" key={check.name}><div><strong>{check.ok ? "🟢" : "🔴"} {check.name}</strong><p className="muted">{check.message}</p></div><span className="status">{check.ok ? "OK" : "Atenção"}</span></div>)}</div>
    <section className="section" style={{ paddingBottom: 0 }}><span className="eyebrow">Problemas registrados · últimos 7 dias</span><div className="list error-list">{errorGroups.map((group) => <div className={`list-row error-row${group.resolved ? " is-resolved" : ""}`} key={group.key}>
      <div><strong>{group.text.area}</strong><p>{group.text.what}</p>{group.resolved ? <p className="muted error-fix">Resolvido: {group.resolvedWhy}.</p> : group.text.fix && <p className="muted error-fix">O que fazer: {group.text.fix}</p>}</div>
      <div className="error-side"><span className={`error-state${group.resolved ? " is-resolved" : ""}`}>{group.resolved ? "Resolvido" : "Pendente"}</span><span className="error-when">{group.count > 1 ? `${group.count} vezes · ` : ""}última {shortDate(parseDbDate(group.last))}</span></div>
    </div>)}{!errorGroups.length && <div className="panel"><p className="muted">Nenhum problema registrado nos últimos 7 dias.</p></div>}</div></section>
    <section className="section" style={{ paddingBottom: 0 }}><span className="eyebrow">Tarefas automáticas · o que fizeram</span><p className="muted status-section-note">O sistema roda sozinho uma tarefa a cada 5 minutos e outra uma vez por dia. Aqui aparecem só as execuções que fizeram algo ou falharam.</p><div className="table-wrap status-section-body"><table><thead><tr><th>Quando</th><th>Tarefa</th><th>Resultado</th></tr></thead><tbody>{notableRuns.map((row, index) => <tr key={index}><td>{shortDate(parseDbDate(row.createdAt))}</td><td>{row.job === "daily" ? "Diária" : "A cada 5 min"}</td><td className={row.ok ? undefined : "form-error"}>{row.ok ? "" : "Falhou: "}{describeRun(row.detail) || "Nada pendente."}</td></tr>)}</tbody></table>{!notableRuns.length && <p className="muted">Nenhuma ação nas últimas horas: tudo em dia.</p>}</div></section>
  </DashboardShell>;
}
