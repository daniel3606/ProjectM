-- ============================================================
-- Marshmallow: Website waitlist
-- Public insert-only; no select/update/delete for anon/authenticated.
-- ============================================================

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'website',
  created_at timestamptz not null default now(),
  constraint waitlist_email_not_blank check (length(trim(email)) > 0),
  constraint waitlist_source_not_blank check (length(trim(source)) > 0)
);

create unique index if not exists waitlist_email_unique
  on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

-- Public website may only insert rows. No SELECT / UPDATE / DELETE policies.
drop policy if exists "Anyone can join waitlist" on public.waitlist;
create policy "Anyone can join waitlist"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (true);
