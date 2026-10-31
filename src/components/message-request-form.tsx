"use client";

import { MessageSquareText } from "lucide-react";
import { useActionState, useState } from "react";
import { requestMessageBookingAction } from "@/app/actions";
import { KeepValuesForm } from "@/components/keep-values-form";
import { TopicIdeas } from "@/components/topic-ideas";

export const MESSAGE_QUESTIONS = 5;

// "Perguntas por mensagem": up to 5 questions, each one arrives in the chat as its own message once
// paid. Every field is required unless the person marks it as not used (the first is always used).
export function MessageRequestForm({ profileId, price, topics }: { profileId: string; price: string; topics: string[] }) {
  const [error, action, pending] = useActionState(requestMessageBookingAction.bind(null, profileId), undefined);
  const [skipped, setSkipped] = useState<boolean[]>(() => Array(MESSAGE_QUESTIONS).fill(false));
  const used = skipped.filter((value) => !value).length;
  return <KeepValuesForm action={action} className="panel form-stack message-request">
    <div className="message-request-head"><span className="message-request-icon" aria-hidden="true"><MessageSquareText size={20}/></span><div><h2>Perguntas por mensagem</h2><p className="muted">{price} · o chat abre assim que o pagamento é confirmado</p></div></div>
    <ul className="message-request-rules"><li>Escreva <strong>até 5 perguntas</strong>. Cada uma chega ao consultor como uma mensagem no chat assim que o pagamento é confirmado.</li><li>Tem menos perguntas? Marque <strong>“Não vou usar esta pergunta”</strong> nas que sobrarem.</li><li>O consultor tem <strong>48 horas</strong> para responder. Se não responder, <strong>o valor volta integralmente para você</strong> e o chat é encerrado.</li></ul>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="message-questions">
      {skipped.map((isSkipped, index) => <div className={`message-question${isSkipped ? " is-skipped" : ""}`} key={index}>
        <label className="field-label" htmlFor={`question-${index + 1}`}>Pergunta {index + 1}</label>
        <textarea className="textarea" id={`question-${index + 1}`} name="question" rows={index === 0 ? 4 : 3} required={!isSkipped} disabled={isSkipped} minLength={5} maxLength={1000} placeholder={index === 0 ? "Conte o contexto e a sua primeira pergunta. Ex.: Recebi uma proposta para o time de dados. Como é a rotina por aí?" : isSkipped ? "Esta pergunta não será enviada." : "Escreva outra pergunta."}/>
        {index === 0 ? <TopicIdeas targetId="question-1" topics={topics}/> : <label className="check-row message-question-skip"><input type="checkbox" checked={isSkipped} onChange={(event) => setSkipped((current) => current.map((value, i) => i === index ? event.target.checked : value))}/><span>Não vou usar esta pergunta</span></label>}
      </div>)}
    </div>
    <p className="muted message-questions-count">{used === 1 ? "1 pergunta será enviada." : `${used} perguntas serão enviadas.`}</p>
    <button className="button button-accent" disabled={pending}>{pending ? "Criando pedido…" : "Continuar para o pagamento"}</button>
  </KeepValuesForm>;
}
