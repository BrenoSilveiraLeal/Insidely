import { confirmConversationAction, disputeBookingAction, releaseEligibleBookings } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { money, shortDate } from "@/lib/format";
import { getViewerDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function statusText(status: string) {
  return ({ PENDING_PAYMENT: "Aguardando pagamento", CONFIRMED: "Confirmada · pagamento retido", AWAITING_CONFIRMATION: "Confirme a conversa", COMPLETED: "Concluída", DISPUTED: "Em análise" } as Record<string,string>)[status] ?? status;
}

export default async function AppointmentsPage() {
  const user = await requireUser([Role.USER, Role.ADMIN]);
  await releaseEligibleBookings();
  const dashboard = await getViewerDashboard(user.id);
  return <DashboardShell mode="user" title="Agendamentos"><div className="grid grid-2">{dashboard?.customerBookings.map((booking) => <article className="panel" key={booking.id}><span className="eyebrow">{statusText(booking.status)} · {shortDate(booking.startsAt)}</span><h2>{booking.professional.user.name}</h2><p className="muted">{booking.durationMinutes} min · {money(booking.totalCents)} · Google Meet</p><div className="meeting-policy compact"><span>↗</span><div><strong>Sala protegida</strong><p>{booking.meetingUrl ? "A sala está disponível." : "O link será criado automaticamente quando a conexão Google Meet da plataforma estiver ativa."}</p></div></div>
    {booking.status === "AWAITING_CONFIRMATION" && <div className="meeting-policy compact"><span>◉</span><div><strong>Você realizou a conversa?</strong><p>{booking.customerConfirmedAt ? "Você confirmou. Aguardando a outra pessoa ou o prazo automático de 24 horas." : "Confirme para liberar o repasse ao consultor. Se houve um problema, abra uma contestação."}</p>{!booking.customerConfirmedAt && <form action={confirmConversationAction.bind(null, booking.id)}><button className="button button-accent button-sm">Confirmar conversa realizada</button></form>}<form className="form-stack" style={{marginTop:12}} action={disputeBookingAction.bind(null, booking.id)}><textarea className="textarea" name="description" minLength={20} placeholder="Descreva o problema para o suporte"/><button className="button button-ghost button-sm">Reportar problema</button></form></div></div>}
    {booking.status === "DISPUTED" && <p className="form-error">A contestação foi registrada. O valor continua retido até o suporte analisar.</p>}
    <p className="muted">Registros de presença e duração ajudam o suporte. A gravação exige aceite específico dos dois participantes.</p></article>)}</div></DashboardShell>;
}
