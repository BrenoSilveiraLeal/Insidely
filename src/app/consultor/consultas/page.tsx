import { Role } from "@/lib/domain";
import { completeBookingAction, confirmConversationAction, disputeBookingAction, releaseEligibleBookings, sendMessageAction, updateConsultantRecordingConsentAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { shortDate } from "@/lib/format";
import { getConsultantDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function stateLabel(status: string) { return ({ CONFIRMED: "Confirmada · valor retido", AWAITING_CONFIRMATION: "Aguardando confirmação", COMPLETED: "Concluída · repasse liberado", DISPUTED: "Em análise pelo suporte" } as Record<string, string>)[status] ?? status; }

export default async function ConsultantConsultationsPage() {
  const user = await requireUser([Role.CONSULTANT]);
  await releaseEligibleBookings();
  const profile = await getConsultantDashboard(user.id);
  return <DashboardShell mode="consultant" title="Consultas"><div className="grid grid-2">{profile?.bookings.map((booking) => <article className="panel" key={booking.id}><span className="eyebrow">{stateLabel(booking.status)} ? {shortDate(booking.startsAt)}</span><h2>{booking.customer.name}</h2><p>{booking.goals}</p>
    {booking.status === "CONFIRMED" && new Date(booking.startsAt.getTime() + booking.durationMinutes * 60_000) <= new Date() && <form action={completeBookingAction.bind(null, booking.id)}><button className="button button-dark button-sm">Informar fim da conversa</button></form>}
    {booking.status === "AWAITING_CONFIRMATION" && <div className="meeting-policy compact"><span>◉</span><div><strong>Confirma dupla</strong><p>{booking.consultantConfirmedAt ? "Voc confirmou. Aguardando a outra pessoa ou o prazo autom?tico." : "Confirme que a conversa aconteceu para agilizar a libera."}</p>{!booking.consultantConfirmedAt && <form action={confirmConversationAction.bind(null, booking.id)}><button className="button button-accent button-sm">Confirmar conversa realizada</button></form>}<form className="form-stack" style={{marginTop:12}} action={disputeBookingAction.bind(null, booking.id)}><textarea className="textarea" name="description" minLength={20} placeholder="Houve algum problema? Explique para o suporte."/><button className="button button-ghost button-sm">Reportar problema</button></form></div></div>}
    {booking.status === "DISPUTED" && <p className="form-error">O repasse est suspenso at a an do suporte.</p>}
    <div className="meeting-policy compact"><span>?-?</span><div><strong>Google Meet protegido</strong><p>{booking.meetingUrl ? "A sala est dispon na sua consulta." : "A sala ser? criada automaticamente quando a integra Google da plataforma estiver conectada."}</p></div></div>
    <form action={updateConsultantRecordingConsentAction.bind(null, booking.id)} className="consent-inline"><label><input name="recordingConsent" type="checkbox" defaultChecked={booking.consultantRecordingConsent} /><span>Autorizo grava apenas se o participante tamb aceitar.</span></label><button className="button button-ghost button-sm">Salvar</button></form>{booking.conversation && <><div className="message-thread">{booking.conversation.messages.map((message) => <div key={message.id} className={`message ${message.senderId === user.id ? "message-own" : ""}`}><small>{message.sender.name}</small><br />{message.body}</div>)}</div><form action={sendMessageAction.bind(null, booking.conversation.id)} style={{ display: "flex", gap: 8 }}><input className="input" name="body" placeholder="Responder" /><button className="button button-dark">Enviar</button></form></>}</article>)}</div></DashboardShell>;
}
