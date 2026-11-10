"use client";

import { MessageSquareText } from "lucide-react";
import { useActionState } from "react";
import { requestMessageBookingAction } from "@/app/actions";

// The paid chat: the customer pays first; the chat opens once the payment is confirmed and only then
// they write (rules in lib/booking-policy.ts).
export function MessageRequestForm({ profileId, price }: { profileId: string; price: string }) {
  const [error, action, pending] = useActionState(requestMessageBookingAction.bind(null, profileId), undefined);
  return <form action={action} className="panel form-stack message-request">
    <div className="message-request-head"><span className="message-request-icon" aria-hidden="true"><MessageSquareText size={20}/></span><div><h2>Abrir chat</h2><p className="muted">{price} · o chat abre assim que o pagamento é confirmado</p></div></div>
    <ul className="message-request-rules">
      <li>Primeiro você paga; o chat abre na hora e você escreve suas perguntas por lá.</li>
      <li>O consultor tem <strong>24 horas</strong> para responder depois da sua primeira mensagem. Se não responder, <strong>o valor volta integralmente para você</strong>.</li>
      <li>Mudou de ideia? Enquanto o consultor não responde, você pode cancelar e recebe 100% de volta.</li>
      <li>Quando suas dúvidas forem respondidas, clique em <strong>“Minhas dúvidas foram respondidas”</strong>. O chat também fecha sozinho depois de 24 horas sem mensagens ou 72 horas depois de aberto; aí você ainda tem 24 horas para contestar.</li>
    </ul>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-accent" disabled={pending}>{pending ? "Criando pedido…" : "Ir para o pagamento"}</button>
  </form>;
}
