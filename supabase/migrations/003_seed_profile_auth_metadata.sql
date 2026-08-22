-- Seed social/email metadata onto new profiles without overwriting later
-- marshmallow display names set during onboarding.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  meta_name text;
  meta_avatar text;
begin
  meta_name := nullif(trim(both from coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), '');
  meta_avatar := nullif(trim(both from coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    ''
  )), '');

  insert into public.profiles (id, email, friend_code, display_name, avatar_url)
  values (
    new.id,
    new.email,
    public.generate_friend_code(),
    meta_name,
    meta_avatar
  );
  return new;
end;
$$;
