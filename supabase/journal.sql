-- FRAGMENTS — carnet personnel
-- Migration non destructive à exécuter dans Supabase > SQL Editor.
-- Elle réutilise la liste d'administrateurs existante du Meilleurgone.

create extension if not exists pgcrypto;

create table if not exists public.bestagone_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

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

create table if not exists public.journal_articles (
  id uuid primary key default gen_random_uuid(),
  slug varchar(96) not null unique,
  title varchar(140) not null,
  kind varchar(40) not null default 'Note',
  excerpt varchar(320) not null default '',
  body text not null,
  status varchar(12) not null default 'published' check (status in ('published', 'draft')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journal_articles_published_at_idx
  on public.journal_articles (published_at desc nulls last);

alter table public.journal_articles enable row level security;

grant select on public.journal_articles to anon, authenticated;
grant insert, update, delete on public.journal_articles to authenticated;

-- Tout le monde peut lire uniquement les textes publiés.
drop policy if exists "published journal articles are public" on public.journal_articles;
create policy "published journal articles are public"
on public.journal_articles
for select
to anon, authenticated
using (status = 'published');

-- L'administrateur peut aussi voir ses brouillons.
drop policy if exists "admins can read all journal articles" on public.journal_articles;
create policy "admins can read all journal articles"
on public.journal_articles
for select
to authenticated
using (public.is_bestagone_admin());

-- Écriture réservée à l'administrateur déjà déclaré dans bestagone_admins.
drop policy if exists "admins can insert journal articles" on public.journal_articles;
create policy "admins can insert journal articles"
on public.journal_articles
for insert
to authenticated
with check (public.is_bestagone_admin() and created_by = auth.uid());

drop policy if exists "admins can update journal articles" on public.journal_articles;
create policy "admins can update journal articles"
on public.journal_articles
for update
to authenticated
using (public.is_bestagone_admin())
with check (public.is_bestagone_admin());

drop policy if exists "admins can delete journal articles" on public.journal_articles;
create policy "admins can delete journal articles"
on public.journal_articles
for delete
to authenticated
using (public.is_bestagone_admin());
