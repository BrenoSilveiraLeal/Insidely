"use client";

import { MessageSquareText } from "lucide-react";
import { useActionState } from "react";
import { requestMessageBookingAction } from "@/app/actions";
import { TopicIdeas } from "@/components/topic-ideas";

// "Perguntas por mensagem": what the person wants to ask, then the checkout. No time slot.
export function MessageRequestForm({ profileId, price, topics }: { profileId: string; price: string; topics: string[] }) {
  const [error, action, pending] = useActionState(requestMessageBookingAction.bind(null, profileId), undefined);
  return <form action={action} className="panel form-stack message-request">
    <div className="message-request-head"><span className="message-request-icon" aria-hidden="true"><MessageSquareText size={20}/></span><div><h2>Perguntas por mensagem</h2><p className="muted">{price} · o chat abre assim que o pagamento é confirmado</p></div></div>
    <ul className="message-request-rules"><li>Você pode enviar <strong>até 5 mensagens</strong> com suas perguntas.</li><li>O consultor tem <strong>48 horas</strong> para responder pelo chat.</li><li>Quando suas dúvidas forem respondidas, você encerra e avalia.</li></ul>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="field"><label htmlFor="goals">O que você quer perguntar?</label><textarea className="textarea" id="goals" name="goals" rows={5} required minLength={12} maxLength={2000} placeholder="Conte o contexto e a sua primeira pergunta. Ex.: Recebi uma proposta para o time de dados. Como é a rotina e a liderança por aí?"/><TopicIdeas targetId="goals" topics={topics}/></div>
    <button className="button button-accent" disabled={pending}>{pending ? "Criando pedido…" : "Continuar para o pagamento"}</button>
  </form>;
}
