import { PublicShell } from "@/components/public-shell";

const sections = [
  ["1. O que é a Insidely", "A Insidely aproxima pessoas que estão pesquisando uma carreira ou empresa de profissionais que aceitam compartilhar experiências. A plataforma não representa empresas citadas e não garante contratação, salário, promoção ou resultado profissional."],
  ["2. Conta e informações", "Para criar uma conta, o usuário deve informar nome, e-mail válido e senha. Quem compartilhar experiências profissionais também deve concluir o perfil profissional com dados verdadeiros e manter as informações atualizadas."],
  ["3. Conversas e pagamentos", "Conversas são agendadas e pagas dentro da plataforma. O acesso à sala é liberado após a confirmação do pagamento. Não é permitido usar perfil, mensagens ou descrição pública para desviar pagamento, divulgar contato pessoal ou negociar a conversa fora da Insidely."],
  ["4. Privacidade e conduta", "Não compartilhe segredos de empresa, dados pessoais de terceiros, informações internas confidenciais, senhas ou material protegido. O consultor decide o que fica público; documentos de verificação não aparecem no perfil."],
  ["5. Gravação e suporte", "Uma conversa só pode ser gravada quando os dois participantes aceitarem expressamente. Registros de presença e duração podem ser usados para suporte e análise de reembolso. Denúncias e pedidos de suporte são avaliados pela plataforma."],
  ["6. Suspensão e encerramento", "A Insidely pode restringir ou encerrar contas que forneçam dados falsos, tentem burlar pagamento, pratiquem assédio, violem privacidade ou descumpram estes termos. O usuário também pode pedir a exclusão da própria conta pela área de configurações."],
];

export default function TermsPage(){return <PublicShell><section className="page-hero" data-mark="§"><div className="container page-hero-inner"><span className="eyebrow">Termos de Uso · versão 2026-08</span><h1>Regras claras para conversas mais seguras.</h1><p>Leia antes de criar uma conta, agendar uma conversa ou publicar uma experiência profissional.</p></div></section><section className="section"><article className="container legal-copy">{sections.map(([title,copy])=><section key={title}><h2>{title}</h2><p>{copy}</p></section>)}<p className="muted">Última atualização: agosto de 2026.</p></article></section></PublicShell>}
