"use client";

import { useEffect, useState } from "react";

const STEPS = {
  customer: [
    ["Bem-vindo à Insidely!", "Aqui você conversa com quem vive ou já viveu a rotina de uma empresa ou profissão antes de tomar uma decisão de carreira."],
    ["Encontre alguém", "Em “Ver plataforma”, busque por empresa, profissão, cargo ou nome, e abra o perfil de quem você quer ouvir."],
    ["Atual ou ex-funcionário", "Você pode conversar com quem trabalha hoje na empresa ou com quem já trabalhou lá. O perfil mostra a época em que a pessoa esteve na empresa, e a busca tem o filtro “Vínculo com a empresa”."],
    ["Abra um chat", "Pague para liberar o chat: ele abre na hora, sem horário marcado, e aparece em Mensagens. Aí é só escrever."],
    ["Converse com calma", "O consultor tem 24 horas para responder. Quando suas dúvidas forem respondidas, encerre o chat e avalie a conversa. Dúvidas? Veja a Central de ajuda."],
  ],
  consultant: [
    ["Bem-vindo, consultor!", "Você compartilha sua experiência por chat e recebe por cada conversa. Este painel mostra seus chats e seus ganhos."],
    ["Proteja sua identidade", "Em Editar perfil, ative o modo anônimo: seu chefe ou ex-chefe não descobre quem você é. Em Horários, diga quando costuma responder."],
    ["Trabalhou em mais de uma empresa?", "Em Editar perfil você pode cadastrar até 3 experiências, atuais ou anteriores. Assim seu perfil aparece na busca de cada uma dessas empresas."],
    ["Ganhe confiança", "Também em Editar perfil, complete seu perfil e envie o comprovante de vínculo para ganhar o selo. Vale crachá, holerite, carteira de trabalho ou termo de rescisão."],
    ["Atenda e receba", "Os chats chegam em Chats. Responda em até 24 horas depois da primeira mensagem do cliente. O valor é liberado em Ganhos quando o chat termina."],
  ],
} as const;

// A short tour on the first visit to the customer or consultant dashboard (remembered per browser;
// a new version key shows the updated tour once to people who saw the old one).
export function WelcomeTour({ kind }: { kind: keyof typeof STEPS }) {
  const key = `insidely-tour-v2-${kind}`;
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => {
    let seen = true;
    try { seen = localStorage.getItem(key) === "done"; } catch { /* storage blocked: skip the tour */ }
    // Opening the tour only on the client, after checking what this browser has seen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) setStep(0);
  }, [key]);
  if (step === null) return null;
  const steps = STEPS[kind];
  const close = () => { try { localStorage.setItem(key, "done"); } catch { /* shown again next time */ } setStep(null); };
  const [title, text] = steps[step];
  return <div className="tour-backdrop" role="dialog" aria-modal="true" aria-labelledby="tour-title">
    <div className="tour-card">
      <span className="eyebrow">{step + 1} de {steps.length}</span>
      <h2 id="tour-title">{title}</h2>
      <p>{text}</p>
      <div className="tour-dots" aria-hidden="true">{steps.map((_, index) => <span key={index} className={index === step ? "active" : ""}/>)}</div>
      <div className="tour-actions">
        <button className="button button-ghost button-sm" type="button" onClick={close}>Pular</button>
        {step < steps.length - 1 ? <button className="button button-accent button-sm" type="button" onClick={() => setStep(step + 1)}>Próximo</button> : <button className="button button-accent button-sm" type="button" onClick={close}>Começar</button>}
      </div>
    </div>
  </div>;
}
