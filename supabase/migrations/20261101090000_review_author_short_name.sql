-- Public profiles listed each reviewer's full name, which tells anyone who hired whom.
-- Keep only the first name and the last name's initial ("Breno L.") in the public view.
do $$
declare
  definition text := pg_get_viewdef('public.public_profile_cards'::regclass, true);
  options text[] := (select reloptions from pg_class where oid = 'public.public_profile_cards'::regclass);
  patched text;
begin
  patched := replace(definition, 'COALESCE(ru.name, ''Consultante''::text)',
    'regexp_replace(btrim(COALESCE(ru.name, ''Cliente''::text)), ''^(\S+).*\s(\S)\S*$''::text, ''\1 \2.''::text)');
  if patched = definition then raise exception 'reviewer name expression not found in public_profile_cards'; end if;
  execute 'create or replace view public.public_profile_cards as ' || patched;
  if options is not null then execute format('alter view public.public_profile_cards set (%s)', array_to_string(options, ', ')); end if;
end $$;
