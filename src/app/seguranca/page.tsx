import Link from "next/link";
import { PublicShell } from "@/components/public-shell";

export const metadata = { title: "Como funciona a segurança", description: "Identificação, sala protegida, moderação, verificação de vínculo e reembolso: como a Insidely protege clientes e consultores." };

const items: [string, string][] = [
  ["Todo mundo se identifica", "Clientes e consultores informam CPF e data de nascimento no cadastro, e cada CPF só pode estar em uma conta. O CPF nunca aparece no site: o consultor vê só uma versão mascarada e a idade de quem agendou. A identificação completa é entregue apenas a autoridades, mediante ordem judicial."],
  ["Vínculo com a empresa verificado", "O consultor pode comprovar que trabalha na empresa com crachá, folha de ponto ou holerite, ou carteira de trabalho digital. A equipe confere o documento antes de exibir o selo “Vínculo verificado”. Sem comprovação, o perfil avisa claramente que a informação foi apenas declarada."],
  ["Sala de vídeo só no horário", "A sala do Google Meet é criada pela Insidely no horário marcado e encerrada ao fim da conversa. O link só funciona para as duas pessoas da conversa, que precisam estar logadas."],
  ["Chat sem contatos e sem ofensas", "O chat bloqueia telefone, e-mail, links, redes sociais, combinação de pagamento por fora, palavrões e ameaças. As mesmas regras valem para avaliações e para os textos dos perfis."],
  ["Denúncias e bloqueio", "Dentro de cada conversa há o botão Denunciar, que leva o caso direto à equipe, e o botão Bloquear, que impede novos agendamentos entre as duas pessoas. A Insidely também registra quem entrou na sala e quando, o que serve de prova em caso de falta."],
  ["Advertência e suspensão", "Quem descumpre as regras recebe advertência e pode ter a conta suspensa ou banida. A suspensão continua valendo mesmo que a pessoa apague a conta e tente voltar com o mesmo CPF."],
  ["Seu dinheiro protegido", "O pagamento fica com a plataforma até a conversa acontecer. Se o consultor cancelar ou for suspenso, o cliente recebe 100% de volta, sem taxa."],
  ["Seus dados, seus direitos", "Você pode baixar uma cópia dos seus dados a qualquer momento, ativar a verificação em duas etapas e recebe um aviso por e-mail quando sua conta é acessada de um aparelho novo. Os registros de acesso são guardados por 6 meses, como exige o Marco Civil da Internet."],
];

export default function SecurityPage() {
  return <PublicShell>
    <section className="page-hero" data-mark="✓"><div className="container page-hero-inner"><span className="eyebrow">Segurança</span><h1>Conversas entre desconhecidos, com proteção dos dois lados.</h1><p>Veja como a Insidely protege quem procura uma conversa e quem compartilha a própria experiência.</p></div></section>
    <section className="section"><div className="container grid grid-2 security-grid">{items.map(([title, text], index) => <article className="panel" key={title}><span className="eyebrow">{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{text}</p></article>)}</div>
      <div className="container"><p className="muted security-note">Detalhes completos nos <Link className="text-link" href="/termos">Termos de Uso</Link> e na <Link className="text-link" href="/privacidade">Política de Privacidade</Link>. Dúvidas sobre seus dados: insidelybrasil@gmail.com.</p></div>
    </section>
  </PublicShell>;
}
