create or replace function public.create_support_report(p_category text, p_description text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user_id text;
  v_report_id text := extensions.gen_random_uuid()::text;
begin
  select id into v_user_id from public."User" where "auth_user_id" = (select auth.uid());
  if v_user_id is null or length(trim(p_category)) not between 2 and 80 or length(trim(p_description)) not between 20 and 4000 then raise exception 'invalid_request'; end if;
  insert into public."Report" (id,"reporterId",category,description,status,"createdAt","updatedAt") values (v_report_id,v_user_id,trim(p_category),trim(p_description),'OPEN',now(),now());
  insert into public."Notification" (id,"userId",title,body,href,"createdAt") select extensions.gen_random_uuid()::text,id,'Nova solicitação de suporte','Uma nova solicitação foi enviada para análise.','/admin/suporte',now() from public."User" where role = 'ADMIN'::public."Role";
end;
$$;
revoke all on function public.create_support_report(text,text) from public, anon;
grant execute on function public.create_support_report(text,text) to authenticated;
