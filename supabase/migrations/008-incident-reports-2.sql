-- Adventure Sports V8.2.2 Incident Reports 2.0
-- Non-destructive: preserves every existing incident report.

alter table public.incident_reports add column if not exists area text;
alter table public.incident_reports add column if not exists before_incident text;
alter table public.incident_reports add column if not exists incident_details text;
alter table public.incident_reports add column if not exists after_incident text;
alter table public.incident_reports add column if not exists responding_staff text;
alter table public.incident_reports add column if not exists parent_notified boolean not null default false;
alter table public.incident_reports add column if not exists coach_notified boolean not null default false;
alter table public.incident_reports add column if not exists manager_notified boolean not null default false;
alter table public.incident_reports add column if not exists first_aid_provided boolean not null default false;
alter table public.incident_reports add column if not exists ems_called boolean not null default false;
alter table public.incident_reports add column if not exists police_called boolean not null default false;
alter table public.incident_reports add column if not exists ambulance_requested boolean not null default false;
alter table public.incident_reports add column if not exists transported_to_hospital boolean not null default false;
alter table public.incident_reports add column if not exists action_items jsonb not null default '[]'::jsonb;
alter table public.incident_reports add column if not exists needs_manager_review boolean not null default true;
alter table public.incident_reports add column if not exists needs_insurance_review boolean not null default false;
alter table public.incident_reports add column if not exists needs_maintenance_review boolean not null default false;
alter table public.incident_reports add column if not exists needs_employee_follow_up boolean not null default false;
alter table public.incident_reports add column if not exists internal_notes text;
alter table public.incident_reports add column if not exists manager_review_status text not null default 'pending';
alter table public.incident_reports add column if not exists reviewed_at timestamptz;
alter table public.incident_reports add column if not exists report_locked boolean not null default false;

do $$ begin
  alter table public.incident_reports add constraint incident_review_status_check
    check (manager_review_status in ('pending','approved','follow_up'));
exception when duplicate_object then null; end $$;

-- Backfill the guided timeline from older reports without deleting legacy content.
update public.incident_reports
set incident_details = coalesce(incident_details, description)
where incident_details is null and description is not null;
