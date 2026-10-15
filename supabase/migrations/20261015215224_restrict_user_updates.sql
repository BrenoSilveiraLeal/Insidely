-- Impede a elevação de papel via update da linha própria.
revoke update on table public."User" from authenticated;
grant update (name, "updatedAt") on table public."User" to authenticated;

-- Participantes não precisam ler a linha privada do outro usuário.
drop policy if exists user_participant_select on public."User";
drop policy if exists user_self_update on public."User";
create policy user_self_update on public."User" for update to authenticated
using ("auth_user_id" = auth.uid())
with check ("auth_user_id" = auth.uid());
