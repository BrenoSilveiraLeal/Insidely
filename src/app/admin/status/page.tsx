import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { appEmailConfigured, smtpConfigured } from "@/lib/email";
import { parseDbDate, shortDate } from "@/lib/format";
import { checkGoogleMeet } from "@/lib/google-meet";
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
    jobCheck("reminders", "Tarefa de 5 minutos (lembretes, salas, avisos)", 20),
    jobCheck("daily", "Tarefa diária (expirações, retenção, avisos)", 26 * 60),
  ];
  return <DashboardShell mode="admin" title="Status do sistema">
    <div className="list">{checks.map((check) => <div className="list-row" key={check.name}><div><strong>{check.ok ? "🟢" : "🔴"} {check.name}</strong><p className="muted">{check.message}</p></div><span className="status">{check.ok ? "OK" : "Atenção"}</span></div>)}</div>
    <section className="section" style={{ paddingBottom: 0 }}><span className="eyebrow">Erros no servidor · últimos 7 dias</span><div className="table-wrap"><table><thead><tr><th>Quando</th><th>Página</th><th>Erro</th></tr></thead><tbody>{((errors ?? []) as { path: string; routeType: string; message: string; createdAt: string }[]).map((row, index) => <tr key={index}><td>{shortDate(parseDbDate(row.createdAt))}</td><td>{row.path}</td><td className="muted">{(row.message ?? "").slice(0, 160)}</td></tr>)}</tbody></table>{!errors?.length && <p className="muted">Nenhum erro registrado.</p>}</div></section>
    <section className="section" style={{ paddingBottom: 0 }}><span className="eyebrow">Últimas execuções</span><div className="table-wrap"><table><thead><tr><th>Quando</th><th>Tarefa</th><th>Resultado</th><th>Detalhe</th></tr></thead><tbody>{runRows.slice(0, 20).map((row, index) => <tr key={index}><td>{shortDate(parseDbDate(row.createdAt))}</td><td>{row.job === "daily" ? "Diária" : "5 minutos"}</td><td>{row.ok ? "OK" : "Falhou"}</td><td className="muted">{(row.detail ?? "").slice(0, 140)}</td></tr>)}</tbody></table></div></section>
  </DashboardShell>;
}
