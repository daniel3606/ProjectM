-- ============================================================
-- Marshmallow: Initial Schema
-- Tables: profiles, focus_sessions, friendships
-- ============================================================

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique,
  display_name text,
  marshmallow_color text,
  total_growth_cm numeric not null default 0,
  total_focus_minutes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if it already exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at on profiles
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- 2. FOCUS SESSIONS
create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  duration_minutes int not null,
  focus_mode text not null,
  growth_cm numeric not null,
  completed_at timestamptz not null
);

-- 3. FRIENDSHIPS
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id != addressee_id)
);

drop trigger if exists friendships_updated_at on public.friendships;
create trigger friendships_updated_at
  before update on public.friendships
  for each row execute function public.update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.friendships enable row level security;

-- PROFILES: anyone can read, only owner can update
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- FOCUS SESSIONS: owner can CRUD, accepted friends can read
create policy "Users can insert own sessions"
  on public.focus_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can view own sessions"
  on public.focus_sessions for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.friendships
      where status = 'accepted'
        and (
          (requester_id = auth.uid() and addressee_id = user_id)
          or (addressee_id = auth.uid() and requester_id = user_id)
        )
    )
  );

create policy "Users can update own sessions"
  on public.focus_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.focus_sessions for delete
  using (auth.uid() = user_id);

-- FRIENDSHIPS: parties can read, requester can insert, addressee can update, either can delete
create policy "Parties can view their friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can send friend requests"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

create policy "Addressee can update friendship status"
  on public.friendships for update
  using (auth.uid() = addressee_id);

create policy "Either party can delete friendship"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
alter publication supabase_realtime add table public.friendships;
