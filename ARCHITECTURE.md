# Arquitetura

## Camadas

- `src/app`: rotas, páginas e Server Actions.
- `src/components`: interface e componentes client.
- `src/lib`: domínio, sessão, políticas, queries e integrações.
- `supabase/migrations`: evolução imperativa do banco, RPCs, RLS e índices.
- `supabase/functions`: operações que exigem Edge Function, como exclusão de conta.

## Identidade

`auth.users` autentica. `public.User` representa a pessoa e guarda o papel atual. `ProfessionalProfile` representa o perfil profissional da pessoa. Um booking usa `customerId` para a pessoa que agenda e `professionalProfileId` para o perfil escolhido.

## Fluxo de booking

`Availability` → `Booking` → `Conversation` + `Payment` + `Notification` → Stripe → mensagens → confirmação → `TransferAttempt` → repasse.

O backend e as RPCs continuam sendo a autoridade de autorização; a interface apenas controla navegação e feedback.
