import { rateCustomerAction, reportConversationAction } from "@/app/actions";
import { CONVERSATION_REPORT_CATEGORIES } from "@/lib/reports";

// "Denunciar" inside a conversation, for either participant. Goes to the admin reports queue with
// the booking attached, so the team sees the chat, the attendance and both identities.
export function ConversationReportForm({ bookingId, otherName, returnTo }: { bookingId: string; otherName: string; returnTo: string }) {
  return <details className="cancel-booking-details conversation-report">
    <summary><span>Denunciar {otherName}</span></summary>
    <form action={reportConversationAction.bind(null, bookingId)} className="form-stack">
      <input type="hidden" name="returnTo" value={returnTo}/>
      <p className="muted">A denúncia vai para a equipe da Insidely, que analisa a conversa e pode suspender a conta. Em caso de crime, a plataforma tem a identificação das duas pessoas para entregar às autoridades.</p>
      <label className="field"><span>O que aconteceu?</span><select className="select" name="category" required defaultValue=""><option value="" disabled>Selecione</option>{CONVERSATION_REPORT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      <label className="field"><span>Descreva</span><textarea className="textarea" name="description" minLength={20} maxLength={2000} required placeholder="Conte o que aconteceu, quando e, se houver, o que foi dito."/></label>
      <button className="button button-danger button-sm" type="submit">Enviar denúncia</button>
    </form>
  </details>;
}

export function reportFeedbackText(code: string) {
  return code === "ok" ? "Denúncia enviada. A equipe da Insidely vai analisar o caso." : code === "curta" ? "Escolha o tipo de problema e descreva com pelo menos 20 caracteres." : "Não foi possível enviar a denúncia. Tente novamente ou fale com o suporte.";
}

// Internal rating of the customer by the consultant, after the conversation. Only the team sees it.
export function CustomerFeedbackForm({ bookingId, customerName }: { bookingId: string; customerName: string }) {
  return <form action={rateCustomerAction.bind(null, bookingId)} className="meeting-policy compact form-stack">
    <strong>Como foi atender {customerName}?</strong>
    <p className="muted">Avaliação interna: o cliente não vê. Ajuda a equipe a identificar comportamentos problemáticos.</p>
    <div className="profile-form-grid">
      <label className="field"><span>Nota</span><select className="select" name="rating" defaultValue="5">{[5, 4, 3, 2, 1, 0].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="field"><span>Comentário (opcional)</span><input className="input" name="comment" maxLength={1000}/></label>
    </div>
    <button className="button button-ghost button-sm" type="submit">Enviar avaliação</button>
  </form>;
}

export function customerFeedbackText(code: string) {
  return code === "ok" ? "Avaliação do cliente registrada." : code === "repetida" ? "Você já avaliou este cliente nesta conversa." : "Não foi possível registrar a avaliação.";
}
