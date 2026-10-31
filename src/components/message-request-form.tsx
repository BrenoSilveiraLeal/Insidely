"use client";

import { MessageSquareText } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { requestMessageBookingAction } from "@/app/actions";
import { KeepValuesForm } from "@/components/keep-values-form";
import { TopicIdeas } from "@/components/topic-ideas";

export const MESSAGE_QUESTIONS = 5;

// "Perguntas por mensagem": up to 5 questions, each one arrives in the chat as its own message once
// paid. Every field is required unless the person marks it as not used (the first is always used).
export function MessageRequestForm({ profileId, price, topics }: { profileId: string; price: string; topics: string[] }) {
  const [error, action, pending] = useActionState(requestMessageBookingAction.bind(null, profileId), undefined);
  const [skipped, setSkipped] = useState<boolean[]>(() => Array(MESSAGE_QUESTIONS).fill(false));
  // What will actually be sent, read from the fields (typed or filled by an idea chip), shown above
  // the payment button so nobody sends five questions without noticing.
  const questionsBox = useRef<HTMLDivElement>(null);
  const [toSend, setToSend] = useState<string[]>([]);
  useEffect(() => {
    const box = questionsBox.current;
    if (!box) return;
    const read = () => setToSend([...box.querySelectorAll<HTMLInputElement>("input[name=question]")].filter((input) => !input.disabled).map((input) => input.value.trim()).filter(Boolean));
    read();
    box.addEventListener("input", read);
    return () => box.removeEventListener("input", read);
  }, [skipped]);
  return <KeepValuesForm action={action} className="panel form-stack message-request">
    <div className="message-request-head"><span className="message-request-icon" aria-hidden="true"><MessageSquareText size={20}/></span><div><h2>Perguntas por mensagem</h2><p className="muted">{price} · o chat abre assim que o pagamento é confirmado</p></div></div>
    <ul className="message-request-rules"><li>Escreva <strong>uma pergunta por campo</strong>, até 5. A primeira chega ao consultor assim que o pagamento é confirmado; quando ele termina de responder uma, a próxima é enviada.</li><li>Tem menos perguntas? Marque <strong>“Não vou usar esta pergunta”</strong> nas que sobrarem.</li><li>O consultor tem <strong>48 horas</strong> para responder. Se não responder, <strong>o valor volta integralmente para você</strong> e o chat é encerrado.</li></ul>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="field"><label htmlFor="greeting">Apresentação (opcional)</label><input className="input" id="greeting" name="greeting" maxLength={140} autoComplete="off" placeholder="Ex.: Boa tarde! Sou estudante de dados e queria entender melhor a área."/><small className="muted">Uma linha curta para se apresentar. Não é uma pergunta: ela chega junto com a primeira.</small></div>
    <div ref={questionsBox} className="message-questions-area"><div className="message-questions">
      {skipped.map((isSkipped, index) => <div className={`message-question${isSkipped ? " is-skipped" : ""}`} key={index}>
        <label className="field-label" htmlFor={`question-${index + 1}`}>Pergunta {index + 1}</label>
        <input className="input" id={`question-${index + 1}`} name="question" autoComplete="off" required={!isSkipped} disabled={isSkipped} minLength={5} maxLength={150} placeholder={index === 0 ? "Ex.: Recebi uma proposta para o time de dados. Como é a rotina por aí?" : isSkipped ? "Esta pergunta não será enviada." : "Escreva outra pergunta."} onInput={(event) => event.currentTarget.setCustomValidity((event.currentTarget.value.match(/\?/g) ?? []).length > 1 ? "Escreva uma pergunta por campo. Use os outros campos para as demais." : "")}/>
        {index > 0 && <label className="check-row message-question-skip"><input type="checkbox" checked={isSkipped} onChange={(event) => setSkipped((current) => current.map((value, i) => i === index ? event.target.checked : value))}/><span>Não vou usar esta pergunta</span></label>}
      </div>)}
    </div>
    <TopicIdeas targetIds={skipped.map((_, index) => `question-${index + 1}`)} topics={topics}/></div>
    <div className="message-questions-summary" aria-live="polite">{toSend.length
      ? <><strong>{toSend.length === 1 ? "Esta pergunta será enviada:" : `Estas ${toSend.length} perguntas serão enviadas:`}</strong><ol>{toSend.map((question, index) => <li key={index}>{question}</li>)}</ol></>
      : <span className="muted">Nenhuma pergunta escrita ainda.</span>}</div>
    <button className="button button-accent" disabled={pending}>{pending ? "Criando pedido…" : "Continuar para o pagamento"}</button>
  </KeepValuesForm>;
}
