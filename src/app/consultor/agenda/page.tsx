import { isSlotStillBookable } from "@/lib/booking-policy";
import { Role } from "@/lib/domain";
import { AvailabilityManager } from "@/components/consultant-availability";
import { PauseProfile, RecurringAvailability } from "@/components/agenda-tools";
import { DashboardShell } from "@/components/dashboard-shell";
import { getConsultantDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { parseDbDate, shortDate } from "@/lib/format";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

const zone = "America/Sao_Paulo";
const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(date);
const time = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(date);

export default async function Page({ searchParams }: { searchParams: Promise<{ pausa?: string; sync?: string; removidos?: string }> }) {
  const user = await requireUser([Role.CONSULTANT]);
  const query = await searchParams;
  const profile = await getConsultantDashboard(user.id);
  // Pause columns are added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pause } = await (createSupabaseServiceClient() as any).from("ProfessionalProfile").select("pausedAt, pausedUntil").eq("userId", user.id).maybeSingle();
  const paused = Boolean(pause?.pausedAt) && (!pause?.pausedUntil || parseDbDate(pause.pausedUntil) > new Date());
  const now = new Date();
  // Booked slots stay until they end; free ones only while someone can still book them.
  const future = (profile?.availability ?? []).filter((slot) => slot.isBooked ? slot.endsAt > now : isSlotStillBookable(slot, now));
  const slots = future.map((slot) => ({ id: slot.id, startsAt: slot.startsAt.toISOString(), endsAt: time(slot.endsAt), isBooked: slot.isBooked, label: shortDate(slot.startsAt) }));
  // Week grid: the next 7 days, one column per day.
  const days = Array.from({ length: 7 }, (_, index) => new Date(now.getTime() + index * 86_400_000));
  return <DashboardShell mode="consultant" title="Agenda">
    {query.pausa === "retomada" && <p className="form-feedback" role="status">Perfil reativado. Ele voltou para a busca.</p>}
    {query.sync && <p className={query.sync === "ok" ? "form-feedback" : "form-error"} role={query.sync === "ok" ? "status" : "alert"}>{query.sync === "ok" ? (Number(query.removidos) > 0 ? `Agenda sincronizada: ${query.removidos} horário(s) livre(s) que batiam com compromissos do Google Agenda foram removidos.` : "Agenda sincronizada: nenhum horário livre batia com compromissos do Google Agenda.") : query.sync === "permission-error" ? "O Google não liberou a leitura da agenda. Tente de novo e, na tela do Google, marque a caixa de permissão da agenda." : query.sync === "api-disabled" ? "A sincronização com o Google Agenda está temporariamente indisponível. A equipe já foi avisada." : query.sync === "account-mismatch" ? "A conta Google escolhida pertence a outro usuário da Insidely." : "Não foi possível sincronizar com o Google Agenda agora."}</p>}
    <div className="agenda-page">
      <PauseProfile upcoming={(profile?.bookings ?? []).filter((booking) => ["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) && booking.startsAt > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).map((booking) => ({ id: booking.id, label: shortDate(booking.startsAt), startsAt: booking.startsAt.toISOString(), customer: booking.customer.name }))} paused={paused} pausedUntilLabel={paused && pause?.pausedUntil ? new Intl.DateTimeFormat("pt-BR", { timeZone: zone, day: "2-digit", month: "long" }).format(parseDbDate(pause.pausedUntil)) : null}/>
      <section className="panel">
        <span className="eyebrow">Próximos 7 dias</span>
        <div className="week-grid">{days.map((day) => {
          const key = dayKey(day);
          const daySlots = future.filter((slot) => dayKey(slot.startsAt) === key).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
          return <div className="week-day" key={key}>
            <strong>{new Intl.DateTimeFormat("pt-BR", { timeZone: zone, weekday: "short", day: "2-digit" }).format(day).replace(".", "")}</strong>
            {daySlots.map((slot) => <span key={slot.id} className={`week-slot${slot.isBooked ? " week-slot-booked" : ""}`} title={slot.isBooked ? "Reservado" : "Livre"}>{time(slot.startsAt)}</span>)}
            {!daySlots.length && <span className="week-empty">—</span>}
          </div>;
        })}</div>
        <p className="muted week-legend"><span className="week-slot">Livre</span> <span className="week-slot week-slot-booked">Reservado</span></p>
      </section>
      <section className="panel agenda-sync"><div><span className="eyebrow">Google Agenda</span><strong>Evite choque de compromissos</strong><p className="muted">Lemos só os horários ocupados das próximas 8 semanas da sua agenda do Google e removemos os horários livres da Insidely que batem com eles. Conversas já reservadas não mudam. Nada fica salvo: sincronize sempre que mudar sua agenda.</p></div><a className="button button-ghost" href="/auth/google-agenda">Sincronizar agora</a></section>
      <RecurringAvailability/>
      <AvailabilityManager slots={slots}/>
    </div>
  </DashboardShell>;
}
