create extension if not exists "pgcrypto" with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  base_currency text not null default 'USD' check (base_currency in ('USD', 'AUD')),
  timezone text not null default 'Australia/Sydney',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.portfolio_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('exchange', 'chain', 'wallet', 'indexer', 'manual')),
  provider text not null,
  label text not null,
  is_enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table public.source_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null,
  provider_account_id text,
  label text not null,
  account_type text not null default 'default',
  is_enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  constraint source_accounts_source_user_fk
    foreign key (user_id, source_id)
    references public.portfolio_sources(user_id, id)
    on delete cascade
);

create unique index source_accounts_provider_account_uidx
on public.source_accounts (user_id, source_id, provider_account_id)
where provider_account_id is not null;

create table public.source_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null,
  account_id uuid,
  address text,
  chain text,
  label text not null,
  wallet_type text not null default 'default',
  is_enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_wallets_source_user_fk
    foreign key (user_id, source_id)
    references public.portfolio_sources(user_id, id)
    on delete cascade,
  constraint source_wallets_account_user_fk
    foreign key (user_id, account_id)
    references public.source_accounts(user_id, id)
    on delete cascade
);

create unique index source_wallets_address_uidx
on public.source_wallets (user_id, source_id, coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(address))
where address is not null;

create index audit_events_user_created_idx
on public.audit_events (user_id, created_at desc);

create index portfolio_sources_user_provider_idx
on public.portfolio_sources (user_id, provider, source_type);

create index source_accounts_user_source_idx
on public.source_accounts (user_id, source_id);

create index source_wallets_user_source_idx
on public.source_wallets (user_id, source_id);

create index source_wallets_user_account_idx
on public.source_wallets (user_id, account_id)
where account_id is not null;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

create trigger set_portfolio_sources_updated_at
before update on public.portfolio_sources
for each row execute function public.set_updated_at();

create trigger set_source_accounts_updated_at
before update on public.source_accounts
for each row execute function public.set_updated_at();

create trigger set_source_wallets_updated_at
before update on public.source_wallets
for each row execute function public.set_updated_at();

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create trigger on_auth_user_profile_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_auth_user_profile();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.audit_events enable row level security;
alter table public.portfolio_sources enable row level security;
alter table public.source_accounts enable row level security;
alter table public.source_wallets enable row level security;

create policy "Users can read their own profile"
on public.profiles
for select
using (auth.uid() = user_id);

create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read their own settings"
on public.user_settings
for select
using (auth.uid() = user_id);

create policy "Users can insert their own settings"
on public.user_settings
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own settings"
on public.user_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read their own audit events"
on public.audit_events
for select
using (auth.uid() = user_id);

create policy "Users can insert their own audit events"
on public.audit_events
for insert
with check (auth.uid() = user_id);

create policy "Users can manage their own portfolio sources"
on public.portfolio_sources
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their own source accounts"
on public.source_accounts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their own source wallets"
on public.source_wallets
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
