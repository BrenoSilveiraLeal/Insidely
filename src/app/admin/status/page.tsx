import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { appEmailConfigured, smtpConfigured } from "@/lib/email";
import { parseDbDate, shortDate } from "@/lib/format";
import { checkGoogleMeet } from "@/lib/google-meet";
import { imageModerationConfigured } from "@/lib/image-moderation";
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

// Health of the pieces the platform depends on: database, Google Meet, e-mail and scheduled jobs.
const RUN_LABELS: Record<string, string> = {
  reminded: "lembrete(s) enviado(s)", reviewPrompts: "pedido(s) de avaliação", closedRooms: "sala(s) encerrada(s)", noShows: "ausência(s) registrada(s)",
  resumedPauses: "pausa(s) encerrada(s)", unreadEmails: "e-mail(s) de mensagem não lida", pushes: "notificação(ões) push",
  released: "repasse(s) liberado(s)", simulationReleased: "repasse(s) de demonstração liberado(s)", expired: "agendamento(s) expirado(s)",
  retention: "registro(s) antigo(s) apagado(s)", suspicious: "conta(s) suspeita(s) sinalizada(s)", decisionPrompts: "aviso(s) de decisão pendente", emptyAgendas: "aviso(s) de agenda vazia",
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
  const [meet, { data: runs }, { count: fallbackRooms }, { data: errors }] = await Promise.all([
    checkGoogleMeet(),
    supabase.from("CronRun").select("job, ok, detail, createdAt").order("createdAt", { ascending: false }).limit(60),
    supabase.from("Booking").select("id", { count: "exact", head: true }).like("meetingUrl", "https://meet.jit.si%").gte("startsAt", daysAgo(7)),
    supabase.from("ErrorEvent").select("path, routeType, message, createdAt").gte("createdAt", daysAgo(7)).order("createdAt", { ascending: false }).limit(30),
  ]);
  const runRows = (runs ?? []) as { job: string; ok: boolean; detail: string | null; createdAt: string }[];
  const notableRuns = runRows.filter((row) => !row.ok || describeRun(row.detail)).slice(0, 15);
  const jobCheck = (job: string, label: string, maxMinutes: number): Check => {
    const last = runRows.find((row) => row.job === job);
    if (!last) return { name: label, ok: false, message: job === "daily" ? "Ainda não há execução registrada. Ela roda todo dia às 1h (horário de Brasília); se continuar assim amanhã, confira os Cron Jobs na Vercel." : "Ainda não há execução registrada." };
    const minutes = minutesSince(parseDbDate(last.createdAt));
    const late = minutes > maxMinutes;
    return { name: label, ok: last.ok && !late, message: `${last.ok ? "Última execução bem-sucedida" : "Última execução FALHOU"} há ${minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`}${late ? " — está atrasada" : ""}.` };
  };
  const checks: Check[] = [
    { name: "Banco de dados", ok: !dbError, message: dbError ? `Erro: ${dbError.message}` : `Respondendo (${dbMs} ms).` },
    { name: "Google Meet", ok: meet.ok, message: meet.message + (fallbackRooms ? ` ${fallbackRooms} sala(s) usaram o Jitsi nos últimos 7 dias.` : "") },
    { name: "Envio de e-mails", ok: appEmailConfigured(), message: appEmailConfigured() ? (smtpConfigured() ? "Configurado via SMTP (Gmail)." : "Configurado via Resend.") : "Nenhum provedor configurado: e-mails não são enviados." },
    { name: "Moderação de fotos", ok: imageModerationConfigured(), message: imageModerationConfigured() ? "Fotos de perfil e capas são verificadas automaticamente antes de serem publicadas." : "DESLIGADA: falta a variável OPENAI_API_KEY na Vercel. Sem ela, qualquer foto é aceita." },
    jobCheck("reminders", "Tarefa de 5 minutos (lembretes, salas, avisos)", 20),
    jobCheck("daily", "Tarefa diária (expirações, retenção, avisos)", 26 * 60),
  ];
  return <DashboardShell mode="admin" title="Status do sistema">
    <div className="list">{checks.map((check) => <div className="list-row" key={check.name}><div><strong>{check.ok ? "🟢" : "🔴"} {check.name}</strong><p className="muted">{check.message}</p></div><span className="status">{check.ok ? "OK" : "Atenção"}</span></div>)}</div>
    <section className="section" style={{ paddingBottom: 0 }}><span className="eyebrow">Erros no servidor · últimos 7 dias</span><div className="table-wrap"><table><thead><tr><th>Quando</th><th>Página</th><th>Erro</th></tr></thead><tbody>{((errors ?? []) as { path: string; routeType: string; message: string; createdAt: string }[]).map((row, index) => <tr key={index}><td>{shortDate(parseDbDate(row.createdAt))}</td><td>{row.path}</td><td className="muted">{(row.message ?? "").slice(0, 160)}</td></tr>)}</tbody></table>{!errors?.length && <p className="muted">Nenhum erro registrado.</p>}</div></section>
    <section className="section" style={{ paddingBottom: 0 }}><span className="eyebrow">Tarefas automáticas · o que fizeram</span><p className="muted">O sistema roda sozinho uma tarefa a cada 5 minutos e outra uma vez por dia. Aqui aparecem só as execuções que fizeram algo ou falharam.</p><div className="table-wrap"><table><thead><tr><th>Quando</th><th>Tarefa</th><th>Resultado</th></tr></thead><tbody>{notableRuns.map((row, index) => <tr key={index}><td>{shortDate(parseDbDate(row.createdAt))}</td><td>{row.job === "daily" ? "Diária" : "A cada 5 min"}</td><td className={row.ok ? undefined : "form-error"}>{row.ok ? "" : "Falhou: "}{describeRun(row.detail) || "Nada pendente."}</td></tr>)}</tbody></table>{!notableRuns.length && <p className="muted">Nenhuma ação nas últimas horas: tudo em dia.</p>}</div></section>
  </DashboardShell>;
}
