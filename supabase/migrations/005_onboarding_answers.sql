-- Structured onboarding answers.
--
-- The flow now asks for several goals and for numeric screen-time values, so
-- the single-value `onboarding_purpose` / `onboarding_screen_time` text columns
-- can no longer represent an answer. Both are kept and still written, so older
-- clients and any existing queries continue to work.

alter table public.profiles
  add column if not exists onboarding_goals text[] not null default '{}',
  add column if not exists onboarding_current_minutes integer,
  add column if not exists onboarding_target_minutes integer;

-- Backfill the goals array from the legacy single purpose answer.
update public.profiles
set onboarding_goals = array[onboarding_purpose]
where onboarding_purpose is not null
  and onboarding_goals = '{}';
