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
    <ul className="message-request-rules"><li>Escreva <strong>uma pergunta por campo</strong>, até 5. A primeira chega ao consultor assim que o pagamento é confirmado; cada vez que ele responde, a próxima é enviada automaticamente.</li><li>Tem menos perguntas? Marque <strong>“Não vou usar esta pergunta”</strong> nas que sobrarem.</li><li>O consultor tem <strong>48 horas</strong> para responder. Se não responder, <strong>o valor volta integralmente para você</strong> e o chat é encerrado.</li></ul>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="field"><label htmlFor="greeting">Apresentação (opcional)</label><input className="input" id="greeting" name="greeting" maxLength={140} autoComplete="off" placeholder="Ex.: Boa tarde! Sou estudante de dados e queria entender melhor a área."/><small className="muted">Uma linha curta para se apresentar. Não é uma pergunta: ela chega junto com a primeira.</small></div>
    <div className="message-questions">
      {skipped.map((isSkipped, index) => <div className={`message-question${isSkipped ? " is-skipped" : ""}`} key={index}>
        <label className="field-label" htmlFor={`question-${index + 1}`}>Pergunta {index + 1}</label>
        <input className="input" id={`question-${index + 1}`} name="question" autoComplete="off" required={!isSkipped} disabled={isSkipped} minLength={5} maxLength={150} placeholder={index === 0 ? "Ex.: Recebi uma proposta para o time de dados. Como é a rotina por aí?" : isSkipped ? "Esta pergunta não será enviada." : "Escreva outra pergunta."} onInput={(event) => event.currentTarget.setCustomValidity((event.currentTarget.value.match(/\?/g) ?? []).length > 1 ? "Escreva uma pergunta por campo. Use os outros campos para as demais." : "")}/>
        {index > 0 && <label className="check-row message-question-skip"><input type="checkbox" checked={isSkipped} onChange={(event) => setSkipped((current) => current.map((value, i) => i === index ? event.target.checked : value))}/><span>Não vou usar esta pergunta</span></label>}
      </div>)}
    </div>
    <TopicIdeas targetIds={skipped.map((_, index) => `question-${index + 1}`)} topics={topics}/>
    <p className="muted message-questions-count">{used === 1 ? "1 pergunta será enviada." : `${used} perguntas serão enviadas.`}</p>
    <button className="button button-accent" disabled={pending}>{pending ? "Criando pedido…" : "Continuar para o pagamento"}</button>
  </KeepValuesForm>;
}
