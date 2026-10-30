-- A consultant cannot save their own profile as a favorite (removing an old one still works).
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.toggle_favorite(text)'::regprocedure);
  v_def := replace(v_def,
    $old$ else
   insert into public."Favorite"$old$,
    $new$ else
   if exists(select 1 from public."ProfessionalProfile" where id=p_profile_id and "userId"=uid) then raise exception 'own_profile'; end if;
   insert into public."Favorite"$new$);
  if v_def !~ 'own_profile' then raise exception 'toggle_favorite insert not found'; end if;
  execute v_def;
end $$;

delete from public."Favorite" f using public."ProfessionalProfile" p
where p.id = f."professionalProfileId" and p."userId" = f."userId";
