-- Deleting an account anonymizes the User row but keeps it, with its CPF, bookings, messages,
-- reports and reviews (delete-account Edge Function). When the same person signs up again with that
-- CPF, the new sign-up takes over the old record instead of starting a new identity: the history of
-- the person stays in one place, which is what a complaint or a legal process needs.
create table if not exists public."AccountReactivationAudit" (
  id text primary key default gen_random_uuid()::text,
  "userId" text not null references public."User"(id),
  "replacedUserId" text not null,
  auth_user_id uuid not null,
  "createdAt" timestamp(3) without time zone not null default now()
);
alter table public."AccountReactivationAudit" enable row level security;
revoke all on public."AccountReactivationAudit" from public, anon, authenticated;

drop function if exists public.save_customer_identity(text, date);
-- Returns 'saved' for a new identity or 'reactivated' when a deleted account came back.
create function public.save_customer_identity(p_cpf text, p_birth_date date)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_user public."User";
  v_old public."User";
  v_identity public."CustomerIdentity";
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
begin
  select * into v_user from public."User" where auth_user_id = auth.uid() for update;
  if v_user.id is null then raise exception 'unauthorized'; end if;
  if not public.is_valid_cpf(v_cpf) then raise exception 'invalid_cpf'; end if;
  if p_birth_date is null or p_birth_date > (current_date - interval '18 years')::date or p_birth_date <= date '1900-01-01' then raise exception 'underage_or_invalid_birth_date'; end if;
  if exists (select 1 from public."CustomerIdentity" where "userId" = v_user.id) then raise exception 'identity_already_registered'; end if;

  select * into v_identity from public."CustomerIdentity" where cpf = v_cpf;
  if v_identity."userId" is null then
    insert into public."CustomerIdentity" ("userId", cpf, "birthDate") values (v_user.id, v_cpf, p_birth_date);
    return 'saved';
  end if;

  select * into v_old from public."User" where id = v_identity."userId" for update;
  -- Only a deleted account can be taken over, only by someone who also knows the birth date, and only
  -- from a fresh sign-up. Anything else is reported as "CPF in use" without revealing more.
  if v_old.auth_user_id is not null or v_old.email not like 'deleted+%@invalid.insidely'
     or v_identity."birthDate" <> p_birth_date
     or exists (select 1 from public."Booking" where "customerId" = v_user.id)
     or exists (select 1 from public."ProfessionalProfile" where "userId" = v_user.id) then
    raise exception 'cpf_in_use';
  end if;

  -- The empty new row gives up its login and e-mail (unique) and stays only as a merged stub.
  update public."User" set auth_user_id = null, email = 'merged+' || v_user.id || '@invalid.insidely', name = 'Conta mesclada', image = null, "onboardingCompleted" = false, "updatedAt" = now()
    where id = v_user.id;
  update public."User" set auth_user_id = auth.uid(), email = v_user.email, name = v_user.name, image = v_user.image, "onboardingCompleted" = true, "updatedAt" = now()
    where id = v_old.id;
  -- A consultant comes back with the profile as it was; new free slots are added again by them.
  update public."ProfessionalProfile" set "isActive" = true, "updatedAt" = now() where "userId" = v_old.id and not "isActive";
  insert into public."AccountReactivationAudit" ("userId", "replacedUserId", auth_user_id) values (v_old.id, v_user.id, auth.uid());
  insert into public."Notification" (id, "userId", title, body, href, "createdAt")
    values (gen_random_uuid()::text, v_old.id, 'Sua conta anterior foi reativada',
            'Este CPF já tinha uma conta na Insidely, que você havia excluído. Ela foi reativada com o seu histórico de conversas e avaliações.',
            case when v_old.role = 'CONSULTANT'::public."Role" then '/consultor' else '/dashboard' end, now());
  return 'reactivated';
end $$;
revoke all on function public.save_customer_identity(text, date) from public, anon;
grant execute on function public.save_customer_identity(text, date) to authenticated;
