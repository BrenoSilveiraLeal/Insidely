-- A consultant without a Pix key does not get paid out: whatever path releases a payment
-- (both sides confirming, the automatic deadline, the simulation), the payment stays held and the
-- consultant is told to add the key. The daily job releases it once the key exists.
create or replace function public.hold_payment_without_pix()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_pix text;
  v_user text;
begin
  select nullif(trim(pp."pixKey"), ''), pp."userId" into v_pix, v_user
  from public."Booking" bk join public."ProfessionalProfile" pp on pp.id = bk."professionalProfileId"
  where bk.id = new."bookingId";
  if v_user is not null and v_pix is null then
    new.status := old.status;
    new."releasedAt" := old."releasedAt";
    -- One notice a day is enough; the daily job also sends an e-mail.
    if not exists (select 1 from public."Notification" where "userId" = v_user and title = 'Cadastre sua chave Pix para receber' and "createdAt" > now() - interval '1 day') then
      insert into public."Notification" (id, "userId", title, body, href, "createdAt")
      values (extensions.gen_random_uuid()::text, v_user, 'Cadastre sua chave Pix para receber', 'Uma conversa sua foi concluída, mas o valor ficou retido porque você ainda não informou uma chave Pix. Cadastre em Editar perfil para receber.', '/consultor/perfil', now());
    end if;
  end if;
  return new;
end $$;

drop trigger if exists payment_hold_without_pix on public."Payment";
create trigger payment_hold_without_pix
  before update of status on public."Payment"
  for each row
  when (new.status = 'RELEASED'::public."PaymentStatus" and old.status is distinct from 'RELEASED'::public."PaymentStatus")
  execute function public.hold_payment_without_pix();

revoke all on function public.hold_payment_without_pix() from public, anon, authenticated;
