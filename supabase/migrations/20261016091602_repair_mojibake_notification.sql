-- Corrige uma notificação legada gravada com UTF-8 interpretado como Latin-1.
update public."Notification"
set title = 'Nova solicitação de conversa',
    body = 'Alguém escolheu um horário no seu perfil. Revise o pedido e acompanhe o pagamento.'
where title = 'Nova solicitaÃ§Ã£o de conversa'
  and body = 'AlguÃ©m escolheu um horÃ¡rio no seu perfil. Revise o pedido e acompanhe o pagamento.';
