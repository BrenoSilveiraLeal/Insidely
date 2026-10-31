import { Fragment } from "react";
import { Ban, Flag } from "lucide-react";
import { blockUserAction, rateCustomerAction, reportConversationAction, unblockFromConversationAction } from "@/app/actions";
import { CONVERSATION_REPORT_CATEGORIES } from "@/lib/reports";

// "Denunciar" inside a conversation, for either participant. Goes to the admin reports queue with
// the booking attached, so the team sees the chat, the attendance and both identities.
export function ConversationReportForm({ bookingId, otherName, returnTo }: { bookingId: string; otherName: string; returnTo: string }) {
  return <details className="cancel-booking-details conversation-report">
    <summary><Flag size={14} aria-hidden="true"/><span>Denunciar</span><span className="sr-only"> {otherName}</span></summary>
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
  return code === "ok" ? "Denúncia enviada. A equipe da Insidely vai analisar o caso." : code === "limite" ? "Você enviou muitas denúncias em pouco tempo. Aguarde uma hora ou fale com o suporte." : code === "curta" ? "Escolha o tipo de problema e descreva com pelo menos 20 caracteres." : "Não foi possível enviar a denúncia. Tente novamente ou fale com o suporte.";
}

// The consultant rates the customer after the conversation (1 to 5 stars). The average and the
// comments form the customer's reputation, which other consultants see before a conversation.
export function CustomerFeedbackForm({ bookingId, customerName }: { bookingId: string; customerName: string }) {
  return <details className="cancel-booking-details customer-feedback">
    <summary><span>★ Avaliar cliente</span></summary>
    <form action={rateCustomerAction.bind(null, bookingId)} className="form-stack">
      <h3>Como foi conversar com {customerName}?</h3>
      <fieldset className="star-rating"><legend>Nota</legend>
        {/* Highest first: with row-reverse they display 1 to 5, and "checked ~ label" fills the lower stars. */}
        {[5, 4, 3, 2, 1].map((value) => <Fragment key={value}><input type="radio" id={`star-${bookingId}-${value}`} name="rating" value={value} required/><label htmlFor={`star-${bookingId}-${value}`} title={`${value} ${value === 1 ? "estrela" : "estrelas"}`}><span aria-hidden="true">★</span><span className="sr-only">{value} {value === 1 ? "estrela" : "estrelas"}</span></label></Fragment>)}
      </fieldset>
      <label className="field"><span>Comentário (opcional)</span><textarea className="textarea" name="comment" maxLength={1000} placeholder="Pontualidade, respeito, preparo para a conversa…"/></label>
      <p className="muted">A nota e o comentário ficam no histórico do cliente e aparecem para outros consultores antes de uma conversa com ele.</p>
      <button className="button button-accent button-sm" type="submit">Enviar avaliação</button>
    </form>
  </details>;
}

export function customerFeedbackText(code: string) {
  return code === "ok" ? "Avaliação do cliente registrada." : code === "ofensiva" ? "O comentário tem palavrões, abreviações ofensivas ou ofensas. Reescreva para enviar." : code === "contato" ? "O comentário parece ter telefone, e-mail, link ou rede social. Reescreva sem dados de contato." : code === "repetida" ? "Você já avaliou este cliente nesta conversa." : "Não foi possível registrar a avaliação.";
}

// Blocking: neither person can book a conversation with the other afterwards (undo in Minha conta).
export function BlockUserForm({ bookingId, otherName, returnTo, blocked = false }: { bookingId: string; otherName: string; returnTo: string; blocked?: boolean }) {
  // Already blocked: one click undoes it, from the same conversation.
  if (blocked) return <form action={unblockFromConversationAction.bind(null, bookingId)} className="unblock-form">
    <input type="hidden" name="returnTo" value={returnTo}/>
    <button className="unblock-button" type="submit"><Ban size={14} aria-hidden="true"/><span>Desbloquear</span><span className="sr-only"> {otherName}</span></button>
  </form>;
  return <details className="cancel-booking-details conversation-report">
    <summary><Ban size={14} aria-hidden="true"/><span>Bloquear</span><span className="sr-only"> {otherName}</span></summary>
    <form action={blockUserAction.bind(null, bookingId)} className="form-stack">
      <input type="hidden" name="returnTo" value={returnTo}/>
      <p className="muted">Depois de bloquear, vocês não conseguem mais agendar conversas um com o outro. As conversas já marcadas continuam valendo; para cancelar, use o cartão da conversa. Para desfazer, vá em Configurações → Pessoas bloqueadas.</p>
      <button className="button button-danger button-sm" type="submit">Confirmar bloqueio</button>
    </form>
  </details>;
}
