-- Adventure Sports V7.5.0 security hardening (non-destructive)
create table if not exists public.security_profiles (
  user_id uuid primary key,
  email text,
  phone_e164 text,
  email_mfa_enabled boolean not null default true,
  sms_mfa_enabled boolean not null default false,
  trusted_device_days integer not null default 14 check (trusted_device_days between 1 and 30),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.security_email_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists security_email_challenges_user_idx on public.security_email_challenges(user_id, created_at desc);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  event_type text not null,
  outcome text not null default 'success',
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists security_events_created_idx on public.security_events(created_at desc);
create index if not exists security_events_user_idx on public.security_events(user_id, created_at desc);

create table if not exists public.security_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.security_profiles enable row level security;
alter table public.security_email_challenges enable row level security;
alter table public.security_events enable row level security;
alter table public.security_rate_limits enable row level security;

revoke all on public.security_profiles from anon, authenticated;
revoke all on public.security_email_challenges from anon, authenticated;
revoke all on public.security_events from anon, authenticated;
revoke all on public.security_rate_limits from anon, authenticated;

grant all on public.security_profiles to service_role;
grant all on public.security_email_challenges to service_role;
grant all on public.security_events to service_role;
grant all on public.security_rate_limits to service_role;
