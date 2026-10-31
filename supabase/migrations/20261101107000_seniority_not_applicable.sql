-- Not every profession has career levels (júnior, pleno, sênior…): "Não se aplica".
alter type public."Seniority" add value if not exists 'NOT_APPLICABLE';

-- "Perguntas por mensagem" on one's own profile, like a video booking (consultants test their own
-- profile as a customer, see 20260824230000_allow_consultant_self_booking).
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.create_message_booking(text, text[], text)'::regprocedure);
  if position('raise exception ''own_profile''' in v_def) = 0 then return; end if;
  execute replace(v_def, 'if v_consultant_id = v_customer_id then raise exception ''own_profile''; end if;', '');
end $$;
