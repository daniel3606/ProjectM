-- Persist onboarding completion and answers on profiles so the
-- flow only runs once per account.

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_purpose text,
  add column if not exists onboarding_screen_time text;

-- Existing users who already set up a marshmallow should skip onboarding.
update public.profiles
set onboarding_completed = true
where onboarding_completed = false
  and (display_name is not null or username is not null or marshmallow_color is not null);
