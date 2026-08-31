-- Growth model: store raw and awarded growth separately.
--
-- `growth_cm` keeps its meaning as the growth the marshmallow actually gained
-- (post daily soft cap). `raw_growth_cm` is what the session earned before the
-- cap — the figure the rest of the day is priced against, and the only one that
-- can be re-capped if the cap curve is retuned.
--
-- Nullable rather than defaulted: rows written before this model existed have
-- no raw figure, and inventing one would corrupt any later recomputation.

alter table public.focus_sessions
  add column if not exists raw_growth_cm numeric;

alter table public.focus_sessions
  add column if not exists block_type text
  check (block_type is null or block_type in ('quick', 'scheduled', 'sleep'));

alter table public.focus_sessions
  add column if not exists is_hard_block boolean not null default false;

-- Growth is awarded per calendar day, so the soft cap and the streak both read
-- a user's sessions by completion time.
create index if not exists focus_sessions_user_completed_at_idx
  on public.focus_sessions (user_id, completed_at desc);
