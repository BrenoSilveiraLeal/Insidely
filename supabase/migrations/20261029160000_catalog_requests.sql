-- Consultants whose company or area is not in the catalog type its name ("Outra"). The profile is
-- saved right away against a placeholder ("Empresa não cadastrada" / "Área não cadastrada") and the
-- typed name goes to the admin queue; approving it creates the entry and moves the experiences.
insert into public."Company" (id, slug, name, sector, description, "logoText", color, location, "updatedAt")
values ('catalog-unlisted-company', 'empresa-nao-cadastrada', 'Empresa não cadastrada', 'Não informado',
        'Empresa ainda em análise para entrar no catálogo da Insidely.', '?', '#98a2b3', 'Brasil', now())
on conflict (id) do nothing;

insert into public."Profession" (id, slug, name, category, description, accent, "updatedAt")
values ('catalog-unlisted-profession', 'area-nao-cadastrada', 'Área não cadastrada', 'Não informado',
        'Área de atuação ainda em análise para entrar no catálogo da Insidely.', '#98a2b3', now())
on conflict (id) do nothing;

-- The name the consultant typed, kept on the experience until the request is resolved.
alter table public."EmploymentExperience" add column if not exists "pendingCompanyName" text;
alter table public."EmploymentExperience" add column if not exists "pendingProfessionName" text;

create table if not exists public."CatalogRequest" (
  id text primary key default gen_random_uuid()::text,
  kind text not null check (kind in ('COMPANY', 'PROFESSION')),
  name text not null check (length(name) between 2 and 80),
  "normalizedName" text not null,
  "userId" text not null references public."User"(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  "resolvedId" text,
  "createdAt" timestamp(3) without time zone not null default now(),
  "reviewedAt" timestamp(3) without time zone
);
create unique index if not exists catalog_request_pending_unique on public."CatalogRequest" (kind, "normalizedName", "userId") where status = 'PENDING';
create index if not exists catalog_request_status_idx on public."CatalogRequest" (status, "createdAt");
alter table public."CatalogRequest" enable row level security;
revoke all on public."CatalogRequest" from public, anon, authenticated;
