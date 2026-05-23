create or replace function public.is_dashboard_owner_email(email text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(email, '')) = 'sandesh043@gmail.com'
$$;

create or replace function public.is_dashboard_owner()
returns boolean
language sql
stable
as $$
  select public.is_dashboard_owner_email(auth.jwt()->>'email')
$$;

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_dashboard_owner_email(new.email) then
    raise exception 'Dashboard access is restricted to the owner';
  end if;

  insert into public.profiles (user_id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    updated_at = now();

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can read their own settings" on public.user_settings;
drop policy if exists "Users can insert their own settings" on public.user_settings;
drop policy if exists "Users can update their own settings" on public.user_settings;
drop policy if exists "Users can read their own audit events" on public.audit_events;
drop policy if exists "Users can insert their own audit events" on public.audit_events;
drop policy if exists "Users can manage their own portfolio sources" on public.portfolio_sources;
drop policy if exists "Users can manage their own source accounts" on public.source_accounts;
drop policy if exists "Users can manage their own source wallets" on public.source_wallets;

create policy "Owner can read their own profile"
on public.profiles
for select
using (auth.uid() = user_id and public.is_dashboard_owner());

create policy "Owner can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = user_id and public.is_dashboard_owner());

create policy "Owner can update their own profile"
on public.profiles
for update
using (auth.uid() = user_id and public.is_dashboard_owner())
with check (auth.uid() = user_id and public.is_dashboard_owner());

create policy "Owner can read their own settings"
on public.user_settings
for select
using (auth.uid() = user_id and public.is_dashboard_owner());

create policy "Owner can insert their own settings"
on public.user_settings
for insert
with check (auth.uid() = user_id and public.is_dashboard_owner());

create policy "Owner can update their own settings"
on public.user_settings
for update
using (auth.uid() = user_id and public.is_dashboard_owner())
with check (auth.uid() = user_id and public.is_dashboard_owner());

create policy "Owner can read their own audit events"
on public.audit_events
for select
using (auth.uid() = user_id and public.is_dashboard_owner());

create policy "Owner can insert their own audit events"
on public.audit_events
for insert
with check (auth.uid() = user_id and public.is_dashboard_owner());

create policy "Owner can manage their own portfolio sources"
on public.portfolio_sources
for all
using (auth.uid() = user_id and public.is_dashboard_owner())
with check (auth.uid() = user_id and public.is_dashboard_owner());

create policy "Owner can manage their own source accounts"
on public.source_accounts
for all
using (auth.uid() = user_id and public.is_dashboard_owner())
with check (auth.uid() = user_id and public.is_dashboard_owner());

create policy "Owner can manage their own source wallets"
on public.source_wallets
for all
using (auth.uid() = user_id and public.is_dashboard_owner())
with check (auth.uid() = user_id and public.is_dashboard_owner());
