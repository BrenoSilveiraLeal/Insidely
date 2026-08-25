# Revisão de segurança Supabase

## Controles verificados

- RLS habilitado nas tabelas sensíveis.
- Identidade derivada de `auth.uid()` e da tabela `User`.
- `create_booking` aceita somente usuário autenticado com papel válido.
- `get_consultant_dashboard` valida o usuário autenticado e localiza o perfil por `ProfessionalProfile.userId`.
- `TransferAttempt` não é exposta para `anon` ou `authenticated`.
- Políticas de Booking, Message, Review e User usam `(select auth.uid())` nas migrations recentes.

## Pontos para revisão contínua

- Views públicas `SECURITY DEFINER` precisam manter retorno limitado a dados públicos.
- Funções privilegiadas devem continuar com `search_path` explícito, validação de identidade e permissões mínimas.
- Advisors de segurança e performance devem ser executados após toda migration de RLS.
