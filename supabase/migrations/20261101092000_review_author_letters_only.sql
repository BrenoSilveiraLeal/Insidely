-- Reviewer short names must ignore symbols ("Breno (teste)" showed as "Breno (."): keep letters and spaces only.
do $$
declare
  definition text := pg_get_viewdef('public.public_profile_cards'::regclass, true);
  options text[] := (select reloptions from pg_class where oid = 'public.public_profile_cards'::regclass);
  patched text;
begin
  patched := replace(definition, 'btrim(COALESCE(ru.name, ''Cliente''::text))',
    'btrim(regexp_replace(COALESCE(ru.name, ''Cliente''::text), ''[^[:alpha:][:space:]]''::text, ''''::text, ''g''::text))');
  if patched = definition then raise exception 'reviewer name expression not found in public_profile_cards'; end if;
  execute 'create or replace view public.public_profile_cards as ' || patched;
  if options is not null then execute format('alter view public.public_profile_cards set (%s)', array_to_string(options, ', ')); end if;
end $$;
