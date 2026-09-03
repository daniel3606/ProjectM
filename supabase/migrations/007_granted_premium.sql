-- Complimentary Premium is a row in public.subscriptions written from the
-- SQL editor / service role. The client may read its own row (and call
-- is_premium for itself) but must never insert or update entitlement.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  product_id text not null default 'com.marshmallow.premium.monthly',
  status text not null default 'inactive'
    check (status in ('active', 'expired', 'cancelled', 'grace_period', 'inactive')),
  original_transaction_id text,
  latest_receipt text,
  purchase_date timestamptz,
  expires_at timestamptz,
  is_trial boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop trigger if exists set_updated_at on public.subscriptions;
create trigger set_updated_at
  before update on public.subscriptions
  for each row execute function public.update_updated_at();

drop policy if exists "Users can insert own subscription" on public.subscriptions;
drop policy if exists "Users can update own subscription" on public.subscriptions;
drop policy if exists "Users can view own subscription" on public.subscriptions;

create policy "Users can view own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

revoke insert, update, delete, truncate on public.subscriptions from anon, authenticated;

create or replace function public.is_premium(check_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is not null and auth.uid() <> check_user_id then
    return false;
  end if;

  return exists (
    select 1 from public.subscriptions
    where user_id = check_user_id
      and status in ('active', 'grace_period')
      and (expires_at is null or expires_at > now())
  );
end;
$$;

grant execute on function public.is_premium(uuid) to authenticated;
