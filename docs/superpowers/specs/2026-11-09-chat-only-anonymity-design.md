# Conversas só por chat + modo anônimo

Data: 2026-11-09 · Aprovado na conversa (modelo A).

## Por quê

Na banca do TCC apontaram um risco: o dono de uma empresa pode pagar alguém para conversar com todos os
profissionais cadastrados da empresa dele e descobrir quem fala o quê — por vídeo a pessoa é identificada
(rosto, voz, nome no Meet). Isso pode virar demissão ou retaliação, inclusive contra ex-funcionários.
Por mensagem, com um apelido, o profissional pode falar sem se expor.

## Metas

1. Acabar com a conversa por vídeo (Google Meet, sala, agendamento por horário, reagendamento).
2. Acabar com o pacote de "5 perguntas enviadas uma a uma". O cliente paga e o chat abre na hora.
3. Um preço só por chat (por perfil).
4. Modo anônimo para o profissional, com aviso claro do risco de usar dados reais.
5. Aba de mensagens com a foto (ou avatar anônimo) de quem está do outro lado.
6. Termos, regras e ajuda reescritos para o novo modelo.

Não-metas: chamada de voz, chat em grupo, novo meio de pagamento.
Anti-meta: o consultor receber sem ter respondido, ou o cliente ficar sem defesa se o consultor sumir.

## Abordagens consideradas

- **A) Chat sob demanda com prazos (escolhida).** Paga quando quiser, chat abre na hora; os horários do
  consultor viram informação ("costuma responder…", "disponível agora"). Vários chats ao mesmo tempo.
- B) Chat ao vivo só na janela do consultor, tempo fixo. Vende pouco e prende o consultor se o cliente some.
- C) Chat com hora marcada. É o modelo atual trocando vídeo por texto; descartado pelo usuário.

## Regras do chat e do dinheiro (pagamento sempre retido pela plataforma)

| Situação | Resultado |
|---|---|
| Cliente clica "Minhas dúvidas foram respondidas" (depois de ao menos uma resposta) | Chat fecha, pagamento liberado ao consultor |
| Consultor clica "Encerrar conversa" (depois de ao menos uma resposta) | Chat fecha; cliente tem 24h para contestar; sem contestação, liberado |
| Consultor não respondeu em 24h após a 1ª mensagem do cliente | Reembolso integral automático, chat fecha |
| 24h sem nenhuma mensagem de nenhum dos dois (depois da 1ª resposta) | Chat fecha; cliente tem 24h para contestar |
| 72h desde a abertura | Chat fecha; cliente tem 24h para contestar |
| Contestação | Suporte decide: reembolso total, parcial ou liberar (já existe) |

Atualização (mesmo dia): o cliente paga primeiro e só depois escreve no chat. O prazo de 24h do consultor conta a partir da primeira mensagem do cliente; se o cliente não escrever em 72h, o valor é devolvido. Também entraram a advertência automática do chat (no máximo uma a cada 24h) e o recurso contra advertências e suspensões. Detalhes em `docs/CONVERSATIONS.md`.

## Anonimato

- Interruptor "Modo anônimo" no perfil. Ligado: exige apelido; esconde nome, sobrenome, foto, faixa
  etária, cidade e datas exatas (as opções de privacidade que já existem). Empresa e cargo continuam,
  porque são o assunto da conversa.
- Aviso no perfil e no cadastro de consultor: usar dados reais permite que o chefe ou ex-chefe descubra.
- A verificação continua: documento só o admin vê; em público só o selo.
- No chat, lembrete fixo para o consultor anônimo não contar detalhes que identifiquem.

## Decisões do construtor (podem ser revistas)

- Banco: reaproveita o formato `MESSAGE` existente (janela de 72h = `durationMinutes` 4320) e as
  colunas de privacidade; vídeo antigo fica só como histórico; novas reservas de horário bloqueadas.
- Fechamento automático por `pg_cron` a cada 10 min (pagamentos simulados); reembolsos Stripe pelo job diário.
- Taxa da plataforma: 20% do preço do consultor, mínimo R$ 5,00, somada ao que o cliente paga (decidido em 10/11/2026 para cobrir o provedor de pagamento e dar margem em chats de ~R$ 30).
- `price30Cents` passa a espelhar o preço do chat para busca/ordenação continuarem funcionando.
- Horários de atendimento: janelas semanais simples (dias + hora início/fim) no perfil.
