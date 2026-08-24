create table if not exists public."ProfileCover"(
  "professionalProfileId" text primary key references public."ProfessionalProfile"(id) on delete cascade,
  image text not null,
  "updatedAt" timestamptz not null default now()
);
alter table public."ProfileCover" enable row level security;
revoke all on public."ProfileCover" from anon, authenticated;
grant select on public."ProfileCover" to anon, authenticated;
drop policy if exists "Public can read profile covers" on public."ProfileCover";
create policy "Public can read profile covers" on public."ProfileCover" for select to anon, authenticated using (true);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-covers','profile-covers',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Users can upload their own profile covers" on storage.objects;
create policy "Users can upload their own profile covers" on storage.objects for insert to authenticated with check(bucket_id='profile-covers' and (storage.foldername(name))[1]='covers' and (storage.foldername(name))[2]=(select auth.uid())::text);
drop policy if exists "Users can delete their own profile covers" on storage.objects;
create policy "Users can delete their own profile covers" on storage.objects for delete to authenticated using(bucket_id='profile-covers' and owner_id=(select auth.uid())::text);

create or replace function public.update_profile_cover(p_image text)
returns void language plpgsql security definer set search_path=public,auth as $$
declare v_profile text;
begin
 select pp.id into v_profile from public."ProfessionalProfile" pp join public."User" u on u.id=pp."userId" where u.auth_user_id=auth.uid() and u.role='CONSULTANT'::public."Role";
 if v_profile is null then raise exception 'profile_not_found'; end if;
 if p_image is null or length(trim(p_image))<10 or p_image not like '%/storage/v1/object/public/profile-covers/%' then raise exception 'invalid_cover'; end if;
 insert into public."ProfileCover"("professionalProfileId",image,"updatedAt") values(v_profile,p_image,now()) on conflict("professionalProfileId") do update set image=excluded.image,"updatedAt"=now();
end $$;
create or replace function public.remove_profile_cover()
returns void language plpgsql security definer set search_path=public,auth as $$
begin
 delete from public."ProfileCover" pc using public."ProfessionalProfile" pp, public."User" u where pc."professionalProfileId"=pp.id and pp."userId"=u.id and u.auth_user_id=auth.uid() and u.role='CONSULTANT'::public."Role";
end $$;
revoke all on function public.update_profile_cover(text),public.remove_profile_cover() from public,anon;
grant execute on function public.update_profile_cover(text),public.remove_profile_cover() to authenticated;
