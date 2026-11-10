import Link from "next/link";
import { BriefcaseBusiness, CreditCard, MessageSquareText, ShieldCheck, type LucideIcon } from "lucide-react";
import { PublicShell } from "@/components/public-shell";

export const metadata = { title: "Central de ajuda", description: "Respostas sobre o chat, pagamento, cancelamento, modo anônimo, verificação e segurança na Insidely.", alternates: { canonical: "/ajuda" } };

const sections: { title: string; icon: LucideIcon; items: [string, string][] }[] = [
  { title: "Como funciona o chat", icon: MessageSquareText, items: [
    ["Como abro um chat?", "Busque por empresa ou profissão, abra o perfil de quem você quer ouvir e clique em “Abrir chat” e confirme o pagamento: o chat abre na hora, sem horário marcado, e você escreve suas perguntas por lá."],
    ["Quanto tempo o consultor tem para responder?", "24 horas depois da sua primeira mensagem. Se ele não responder nesse prazo, o chat é encerrado e você recebe 100% de volta automaticamente. No perfil aparecem os horários em que ele costuma responder."],
    ["Quando o chat fecha?", "Quando você clica em “Minhas dúvidas foram respondidas”, quando o consultor encerra a conversa, depois de 24 horas sem mensagens de nenhum dos dois ou 72 horas depois de aberto."],
    ["Posso trocar contato com o consultor pelo chat?", "Não. O chat bloqueia telefone, e-mail, links e redes sociais, para que pagamento e conversa fiquem protegidos pela plataforma."],
    ["Preciso informar CPF?", "Sim. Toda conta, de cliente ou de consultor, se identifica com CPF e data de nascimento. Isso protege os dois lados: o CPF não aparece no site e só é entregue a autoridades mediante ordem judicial."],
  ] },
  { title: "Pagamento e cancelamento", icon: CreditCard, items: [
    ["Quando eu pago?", "Antes de conversar: o pagamento libera o chat. O pedido fica aguardando o pagamento por 30 minutos; depois disso, expira sem cobrança."],
    ["Posso cancelar?", "Sim, enquanto o consultor ainda não respondeu: você recebe 100% de volta. Depois da primeira resposta não dá mais para cancelar; se suas dúvidas não forem respondidas, você contesta quando o chat fechar."],
    ["E se as respostas não me ajudaram?", "Quando o chat fecha, você tem 24 horas para contestar. O suporte lê a conversa e decide: devolve tudo, uma parte ou libera o pagamento ao consultor."],
    ["Dá para remarcar?", "Não é preciso: como não há horário marcado, é só abrir um novo chat quando quiser."],
    ["Onde está meu comprovante?", "Em Mensagens, no cartão do chat, em “Mais opções” → “Ver comprovante”. Dá para imprimir ou salvar em PDF."],
  ] },
  { title: "Para consultores", icon: BriefcaseBusiness, items: [
    ["Meu chefe pode descobrir que estou aqui?", "Se você usar nome e foto reais, sim: alguém da empresa pode encontrar seu perfil ou abrir um chat como cliente. Para evitar isso, ative o modo anônimo em Editar perfil: aparecem só um apelido, a empresa e o cargo. No chat, evite detalhes que identifiquem você."],
    ["Como recebo?", "O valor fica retido durante o chat. É liberado quando o cliente confirma que as dúvidas foram respondidas ou 24 horas depois que o chat fecha, sem contestação, já sem a taxa da plataforma. Acompanhe em Ganhos."],
    ["Posso atender vários chats ao mesmo tempo?", "Sim. Responda cada um em até 24 horas depois da primeira mensagem do cliente. Se não puder atender um chat, recuse antes de responder: o cliente recebe 100% de volta."],
    ["Como ganho o selo de vínculo verificado?", "Em Editar perfil, envie uma foto ou PDF do crachá, da folha de ponto ou holerite, ou da carteira de trabalho digital. A equipe confere e aprova. No modo anônimo, o documento continua visível só para a equipe."],
    ["Posso tirar férias?", "Sim. Em Horários, use “Pausa ou férias”. Seu perfil sai da busca e ninguém abre chats novos até a data de volta."],
  ] },
  { title: "Conta e segurança", icon: ShieldCheck, items: [
    ["Alguém foi ofensivo comigo. O que faço?", "Na própria conversa, use “Denunciar” e, se quiser, “Bloquear”. A equipe analisa e pode advertir, suspender ou banir a conta."],
    ["Recebi uma advertência injusta. E agora?", "Em Minha conta → “Ver advertências”, clique em “Recorrer” e explique o que aconteceu. O suporte analisa; se concordar, a advertência é removida. Suspensões também aceitam recurso, inclusive pela tela de conta suspensa."],
    ["Mandei várias mensagens bloqueadas seguidas. Levo várias advertências?", "Não. Mensagens bloqueadas geram no máximo uma advertência automática a cada 24 horas."],
    ["Como baixo meus dados?", "Em Minha conta → “Baixar meus dados”. O arquivo traz tudo o que guardamos sobre você."],
    ["Recebi um e-mail de novo acesso que não fui eu.", "Troque sua senha em “Esqueci minha senha” e ative a verificação em duas etapas em Minha conta."],
  ] },
];

export default function HelpPage() {
  const faqJsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: sections.flatMap((section) => section.items.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } }))) };
  return <PublicShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}/>
    <section className="page-hero" data-mark="?"><div className="container page-hero-inner"><span className="eyebrow">Central de ajuda</span><h1>Como podemos ajudar?</h1><p>As dúvidas mais comuns sobre o chat, pagamento, anonimato e segurança.</p></div></section>
    <section className="section"><div className="container help-sections">{sections.map((section) => { const Icon = section.icon; return <section key={section.title} className="help-section panel"><header className="help-section-head"><span className="help-section-icon" aria-hidden="true"><Icon size={20}/></span><h2>{section.title}</h2></header><div className="help-items">{section.items.map(([question, answer]) => <details className="help-item" key={question}><summary><span>{question}</span><span className="help-toggle" aria-hidden="true"/></summary><p>{answer}</p></details>)}</div></section>; })}
      <p className="muted">Não encontrou? <Link className="text-link" href="/suporte">Fale com o suporte</Link> ou veja <Link className="text-link" href="/seguranca">como funciona a segurança</Link>.</p>
    </div></section>
  </PublicShell>;
}
