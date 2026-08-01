-- Adventure Sports V8.2 — Trusted Devices and Incident Reports 2.0

create table if not exists public.security_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  token_id text not null unique,
  device_name text,
  browser text,
  operating_system text,
  user_agent text,
  last_ip text,
  trusted_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists security_trusted_devices_user_idx on public.security_trusted_devices(user_id, revoked_at, expires_at desc);
alter table public.security_trusted_devices enable row level security;
revoke all on public.security_trusted_devices from anon, authenticated;
grant all on public.security_trusted_devices to service_role;

alter table public.incident_reports add column if not exists timeline_before text;
alter table public.incident_reports add column if not exists timeline_event text;
alter table public.incident_reports add column if not exists timeline_after text;
alter table public.incident_reports add column if not exists response_details jsonb not null default '{}'::jsonb;
alter table public.incident_reports add column if not exists follow_up jsonb not null default '{}'::jsonb;
alter table public.incident_reports add column if not exists responding_staff text;
alter table public.incident_reports add column if not exists internal_notes text;
alter table public.incident_reports add column if not exists manager_review_status text not null default 'pending';
