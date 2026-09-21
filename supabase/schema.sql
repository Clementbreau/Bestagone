-- LE MEILLEURGONE V2 — Supabase schema
-- À exécuter une fois dans Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.hexagons (
  id uuid primary key default gen_random_uuid(),
  title varchar(48) not null,
  description varchar(180) not null,
  image_url text not null,
  image_path text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.bestagone_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.hexagons enable row level security;
alter table public.bestagone_admins enable row level security;

grant select on public.hexagons to anon, authenticated;
grant insert, delete on public.hexagons to authenticated;
grant select on public.bestagone_admins to authenticated;

-- Un compte connecté ne peut voir que sa propre appartenance à la liste des admins.
drop policy if exists "admin can read own membership" on public.bestagone_admins;
create policy "admin can read own membership"
on public.bestagone_admins
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.is_bestagone_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bestagone_admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_bestagone_admin() from public;
grant execute on function public.is_bestagone_admin() to authenticated;

-- Lecture publique des archives.
drop policy if exists "hexagons are public" on public.hexagons;
create policy "hexagons are public"
on public.hexagons
for select
to anon, authenticated
using (true);

-- Écriture uniquement pour les comptes explicitement ajoutés à bestagone_admins.
drop policy if exists "admins can insert hexagons" on public.hexagons;
create policy "admins can insert hexagons"
on public.hexagons
for insert
to authenticated
with check (public.is_bestagone_admin() and created_by = auth.uid());

drop policy if exists "admins can delete hexagons" on public.hexagons;
create policy "admins can delete hexagons"
on public.hexagons
for delete
to authenticated
using (public.is_bestagone_admin());

-- Bucket public pour que les images puissent être affichées directement dans les cartes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hexagons',
  'hexagons',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Le SDK Storage a besoin de SELECT + DELETE pour supprimer un objet.
drop policy if exists "admins can read storage objects" on storage.objects;
create policy "admins can read storage objects"
on storage.objects
for select
to authenticated
using (bucket_id = 'hexagons' and public.is_bestagone_admin());

drop policy if exists "admins can upload storage objects" on storage.objects;
create policy "admins can upload storage objects"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'hexagons' and public.is_bestagone_admin());

drop policy if exists "admins can delete storage objects" on storage.objects;
create policy "admins can delete storage objects"
on storage.objects
for delete
to authenticated
using (bucket_id = 'hexagons' and public.is_bestagone_admin());

-- APRÈS avoir créé vos comptes dans Authentication > Users,
-- ajoute leurs UUID ici (une ligne par personne) :
-- insert into public.bestagone_admins (user_id) values ('UUID_DU_COMPTE');
