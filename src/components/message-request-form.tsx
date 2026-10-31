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
    <ul className="message-request-rules"><li>Escreva <strong>todas as suas perguntas aqui, de uma vez</strong>. Elas chegam ao consultor numa única mensagem assim que o pagamento é confirmado.</li><li>O consultor tem <strong>48 horas</strong> para responder pelo chat.</li><li>Se ele não responder nesse prazo, <strong>o valor volta integralmente para você</strong> e o chat é encerrado.</li></ul>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="field"><label htmlFor="goals">O que você quer perguntar?</label><textarea className="textarea" id="goals" name="goals" rows={5} required minLength={12} maxLength={2000} placeholder="Conte o contexto e escreva todas as suas perguntas. Ex.: Recebi uma proposta para o time de dados. 1) Como é a rotina? 2) Como é a liderança? 3) Dá para crescer em dois anos?"/><TopicIdeas targetId="goals" topics={topics}/></div>
    <button className="button button-accent" disabled={pending}>{pending ? "Criando pedido…" : "Continuar para o pagamento"}</button>
  </form>;
}
