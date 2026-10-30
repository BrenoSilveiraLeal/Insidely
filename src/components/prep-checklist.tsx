import { Clock, MessageSquareText, Video, Wifi } from "lucide-react";

const TIPS = [
  { icon: Video, title: "Teste câmera e microfone", text: <>Abra <a className="text-link" href="https://meet.google.com/new" target="_blank" rel="noreferrer">meet.google.com/new</a> e use “Verificar áudio e vídeo”.</> },
  { icon: Wifi, title: "Lugar tranquilo", text: "Silêncio e uma internet estável fazem diferença em 30 minutos." },
  { icon: MessageSquareText, title: "Suas perguntas", text: "Releia o que foi combinado e anote o que quer perguntar." },
  { icon: Clock, title: "Pontualidade", text: "A sala abre exatamente no horário marcado." },
];

// A short guide shown in the hours before a conversation: tips to read, nothing to tick.
export function PrepChecklist() {
  return <section className="prep-tips" aria-label="Dicas para a conversa">
    <span className="eyebrow">Antes da conversa</span>
    <div className="prep-tips-grid">{TIPS.map(({ icon: Icon, title, text }) => <div className="prep-tip" key={title}><span className="prep-tip-icon" aria-hidden="true"><Icon size={17}/></span><div><strong>{title}</strong><p>{text}</p></div></div>)}</div>
  </section>;
}
