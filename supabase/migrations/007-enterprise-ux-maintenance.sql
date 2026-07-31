-- Adventure Sports V8.1 maintenance experience metadata
alter table public.security_system_settings add column if not exists maintenance_reason text;
alter table public.security_system_settings add column if not exists maintenance_expected_end timestamptz;
alter table public.security_system_settings add column if not exists maintenance_started_at timestamptz;
alter table public.security_system_settings add column if not exists maintenance_started_by_email text;
