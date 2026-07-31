-- Adventure Sports V8.0 Enterprise Security (non-destructive)
create table if not exists public.security_system_settings (
  singleton boolean primary key default true check (singleton),
  maintenance_mode boolean not null default false,
  maintenance_message text not null default 'The Operations Hub is temporarily read-only for maintenance.',
  session_epoch timestamptz not null default now(),
  panic_lock_at timestamptz,
  panic_lock_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.security_system_settings(singleton) values(true) on conflict(singleton) do nothing;

create table if not exists public.security_account_controls (
  user_id uuid primary key,
  disabled boolean not null default false,
  disabled_reason text,
  disabled_at timestamptz,
  disabled_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.security_backups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid,
  created_by_email text,
  label text,
  table_count integer not null default 0,
  row_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  checksum text,
  created_at timestamptz not null default now()
);
create index if not exists security_backups_created_idx on public.security_backups(created_at desc);

create table if not exists public.security_permission_grants (
  role text not null,
  permission text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key(role, permission)
);

alter table public.security_system_settings enable row level security;
alter table public.security_account_controls enable row level security;
alter table public.security_backups enable row level security;
alter table public.security_permission_grants enable row level security;
revoke all on public.security_system_settings, public.security_account_controls, public.security_backups, public.security_permission_grants from anon, authenticated;
grant all on public.security_system_settings, public.security_account_controls, public.security_backups, public.security_permission_grants to service_role;

-- Security logs are append-only to application code. Block update/delete even for accidental SQL grants.
create or replace function public.prevent_security_event_mutation() returns trigger language plpgsql as $$
begin raise exception 'security_events is append-only'; end $$;
drop trigger if exists security_events_append_only on public.security_events;
create trigger security_events_append_only before update or delete on public.security_events
for each row execute function public.prevent_security_event_mutation();
