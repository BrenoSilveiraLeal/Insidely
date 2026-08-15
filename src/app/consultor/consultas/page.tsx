import { Role } from "@prisma/client";
import { sendMessageAction, updateConsultantRecordingConsentAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { shortDate } from "@/lib/format";
import { getConsultantDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ConsultantConsultationsPage() {
  const user = await requireUser([Role.CONSULTANT]);
  const profile = await getConsultantDashboard(user.id);
  return <DashboardShell mode="consultant" title="Consultas"><div className="grid grid-2">{profile?.bookings.map((booking) => <article className="panel" key={booking.id}><span className="eyebrow">{booking.status} · {shortDate(booking.startsAt)}</span><h2>{booking.customer.name}</h2><p>{booking.goals}</p><div className="meeting-policy compact"><span>◉</span><div><strong>Google Meet protegido</strong><p>O link é liberado pouco antes da conversa. Presença e duração ficam registradas para suporte.</p></div></div><form action={updateConsultantRecordingConsentAction.bind(null, booking.id)} className="consent-inline"><label><input name="recordingConsent" type="checkbox" defaultChecked={booking.consultantRecordingConsent} /><span>Autorizo gravação apenas se o participante também aceitar.</span></label><button className="button button-ghost button-sm">Salvar</button></form>{booking.conversation && <><div className="message-thread">{booking.conversation.messages.map((message) => <div key={message.id} className={`message ${message.senderId === user.id ? "message-own" : ""}`}><small>{message.sender.name}</small><br />{message.body}</div>)}</div><form action={sendMessageAction.bind(null, booking.conversation.id)} style={{ display: "flex", gap: 8 }}><input className="input" name="body" placeholder="Responder" /><button className="button button-dark">Enviar</button></form></>}</article>)}</div></DashboardShell>;
}
