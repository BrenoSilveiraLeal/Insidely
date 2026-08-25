# Testes E2E

Os testes públicos atuais cobrem home, busca, redirecionamento protegido, callback e overflow responsivo.

O fluxo autenticado recomendado usa duas contas isoladas: uma consultora e uma cliente. Deve validar booking, Conversation, Payment, Notification, mensagens após pagamento, logout/login, Meet e transferência mockada.

Credenciais externas não devem ser usadas em testes determinísticos. Stripe, Google Meet, Resend e cron devem ter adaptadores mockados.
