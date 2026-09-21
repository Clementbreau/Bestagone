-- BESTAGONE — page ART
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Les images ART utilisent le bucket existant "hexagons", dans le dossier art/.

create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 64),
  description text not null check (char_length(description) between 1 and 260),
  image_url text not null,
  image_path text,
  created_at timestamptz not null default now()
);

alter table public.artworks enable row level security;

grant select, insert, delete on public.artworks to anon, authenticated;

drop policy if exists "public can read artworks" on public.artworks;
drop policy if exists "public can insert artworks" on public.artworks;
drop policy if exists "public can delete artworks" on public.artworks;

create policy "public can read artworks"
on public.artworks
for select
to anon, authenticated
using (true);

create policy "public can insert artworks"
on public.artworks
for insert
to anon, authenticated
with check (true);

create policy "public can delete artworks"
on public.artworks
for delete
to anon, authenticated
using (true);

-- Politiques Storage limitées au sous-dossier art/ du bucket hexagons.
-- Elles peuvent coexister avec les politiques déjà utilisées par les Archives.

drop policy if exists "public can read art images" on storage.objects;
drop policy if exists "public can upload art images" on storage.objects;
drop policy if exists "public can delete art images" on storage.objects;

create policy "public can read art images"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'hexagons'
  and (storage.foldername(name))[1] = 'art'
);

create policy "public can upload art images"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'hexagons'
  and (storage.foldername(name))[1] = 'art'
);

create policy "public can delete art images"
on storage.objects
for delete
to anon, authenticated
using (
  bucket_id = 'hexagons'
  and (storage.foldername(name))[1] = 'art'
);
