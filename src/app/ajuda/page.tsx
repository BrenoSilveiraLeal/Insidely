import Link from "next/link";
import { BriefcaseBusiness, CalendarDays, CreditCard, ShieldCheck, Video, type LucideIcon } from "lucide-react";
import { PublicShell } from "@/components/public-shell";

export const metadata = { title: "Central de ajuda", description: "Respostas sobre agendamento, pagamento, sala de vídeo, cancelamento, verificação e segurança na Insidely.", alternates: { canonical: "/ajuda" } };

const sections: { title: string; icon: LucideIcon; items: [string, string][] }[] = [
  { title: "Agendamento", icon: CalendarDays, items: [
    ["Como agendo uma conversa?", "Busque por empresa ou profissão, abra o perfil de quem você quer ouvir, escolha um horário livre e conte o que você quer conversar. Depois é só confirmar o pagamento."],
    ["O consultor não tem horário. E agora?", "No perfil dele, clique em “Avise-me quando abrir horário”. Você recebe uma notificação e um e-mail assim que ele abrir a agenda."],
    ["Preciso informar CPF?", "Sim. Toda conta, de cliente ou de consultor, se identifica com CPF e data de nascimento. Isso protege os dois lados: o CPF não aparece no site e só é entregue a autoridades mediante ordem judicial."],
  ] },
  { title: "Pagamento e cancelamento", icon: CreditCard, items: [
    ["Quando eu pago?", "Logo depois de escolher o horário. O horário fica reservado só para você por 5 minutos enquanto você conclui o pagamento; sem pagamento, ele volta para o perfil."],
    ["Posso cancelar?", "Sim, antes do horário marcado. Com mais de 24 horas de antecedência você recebe 100% de volta; dentro das 24 horas, há uma taxa de 10%. Se o consultor cancelar, você recebe 100% de volta."],
    ["Onde está meu comprovante?", "Em Mensagens, no cartão da conversa, em “Mais opções” → “Ver comprovante”. Dá para imprimir ou salvar em PDF."],
  ] },
  { title: "A conversa", icon: Video, items: [
    ["Como entro na sala?", "Pelo link da Insidely que aparece no chat, no e-mail e no cartão da conversa. A sala do Google Meet abre exatamente no horário marcado e é encerrada no fim."],
    ["Posso trocar contato com o consultor pelo chat?", "Não. O chat bloqueia telefone, e-mail, links e redes sociais, para que pagamento e conversa fiquem protegidos pela plataforma."],
    ["E se o consultor não aparecer?", "A Insidely registra quem entrou na sala. Se só você entrou, você recebe um aviso e pode abrir uma contestação em Agendamentos; o valor não é repassado enquanto o caso é analisado."],
  ] },
  { title: "Para consultores", icon: BriefcaseBusiness, items: [
    ["Como recebo?", "O valor fica retido até a conversa acontecer e é liberado quando vocês dois confirmam (ou 24 horas depois do fim, sem contestação), já sem a taxa da plataforma. Acompanhe em Ganhos."],
    ["Como ganho o selo de vínculo verificado?", "Em Editar perfil, envie uma foto ou PDF do crachá, da folha de ponto ou holerite, ou da carteira de trabalho digital. A equipe confere e aprova."],
    ["Posso tirar férias?", "Sim. Na Agenda, use “Pausa ou férias”. Antes, faça ou cancele as conversas marcadas no período; no cancelamento o cliente recebe 100% de volta."],
  ] },
  { title: "Conta e segurança", icon: ShieldCheck, items: [
    ["Alguém foi ofensivo comigo. O que faço?", "Na própria conversa, use “Denunciar” e, se quiser, “Bloquear”. A equipe analisa e pode advertir, suspender ou banir a conta."],
    ["Como baixo meus dados?", "Em Minha conta → “Baixar meus dados”. O arquivo traz tudo o que guardamos sobre você."],
    ["Recebi um e-mail de novo acesso que não fui eu.", "Troque sua senha em “Esqueci minha senha” e ative a verificação em duas etapas em Minha conta."],
  ] },
];

export default function HelpPage() {
  const faqJsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: sections.flatMap((section) => section.items.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } }))) };
  return <PublicShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}/>
    <section className="page-hero" data-mark="?"><div className="container page-hero-inner"><span className="eyebrow">Central de ajuda</span><h1>Como podemos ajudar?</h1><p>As dúvidas mais comuns sobre agendamento, pagamento, sala de vídeo e segurança.</p></div></section>
    <section className="section"><div className="container help-sections">{sections.map((section) => { const Icon = section.icon; return <section key={section.title} className="help-section panel"><header className="help-section-head"><span className="help-section-icon" aria-hidden="true"><Icon size={20}/></span><h2>{section.title}</h2></header><div className="help-items">{section.items.map(([question, answer]) => <details className="help-item" key={question}><summary><span>{question}</span><span className="help-toggle" aria-hidden="true"/></summary><p>{answer}</p></details>)}</div></section>; })}
      <p className="muted">Não encontrou? <Link className="text-link" href="/suporte">Fale com o suporte</Link> ou veja <Link className="text-link" href="/seguranca">como funciona a segurança</Link>.</p>
    </div></section>
  </PublicShell>;
}
