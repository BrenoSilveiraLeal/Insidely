# Observabilidade

Eventos financeiros devem registrar, sem segredos:

- bookingId;
- paymentId;
- stripeEventId;
- transferId;
- tipo do evento;
- tentativa;
- duração;
- resultado;
- erro resumido.

Nunca registrar senha, token, cartão, código MFA ou conteúdo privado de mensagens.

As fontes principais são logs da Vercel, logs do Supabase e a tabela `TransferAttempt`.
