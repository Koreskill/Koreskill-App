-- KORE CREATIVE OS — AUTENTICACIÓN Y AUDITORÍA

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'blocked')),
  role text not null default 'user'
    check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  last_login_at timestamptz
);

create table if not exists public.portal_access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null
    check (event in ('signup', 'email_verified', 'login', 'logout')),
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app text not null check (app in ('properties', 'creatives')),
  prediction_id text not null unique,
  property_id text,
  prompt text,
  aspect_ratio text,
  quality text,
  estimated_cost_usd numeric(10, 4) not null default 0,
  status text not null default 'starting',
  output_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx
  on public.profiles(email);

create index if not exists portal_access_logs_user_idx
  on public.portal_access_logs(user_id, created_at desc);

create index if not exists generation_logs_user_idx
  on public.generation_logs(user_id, created_at desc);

create index if not exists generation_logs_property_idx
  on public.generation_logs(property_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;

  insert into public.portal_access_logs (user_id, event)
  values (new.id, 'signup');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.portal_access_logs enable row level security;
alter table public.generation_logs enable row level security;

drop policy if exists "users read own profile" on public.profiles;

create policy "users read own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "users update own name" on public.profiles;

drop policy if exists "users insert own access logs"
  on public.portal_access_logs;

create policy "users insert own access logs"
  on public.portal_access_logs
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "users read own access logs"
  on public.portal_access_logs;

create policy "users read own access logs"
  on public.portal_access_logs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users insert own generations"
  on public.generation_logs;

create policy "users insert own generations"
  on public.generation_logs
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "users update own generations"
  on public.generation_logs;

create policy "users update own generations"
  on public.generation_logs
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users read own generations"
  on public.generation_logs;

create policy "users read own generations"
  on public.generation_logs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert on public.portal_access_logs to authenticated;
grant select, insert, update on public.generation_logs to authenticated;