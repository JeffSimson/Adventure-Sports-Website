create table if not exists public.clover_employee_mappings (
  id uuid primary key default gen_random_uuid(),
  clover_employee_id text not null unique,
  clover_employee_name text,
  employee_id uuid references public.employees(id) on delete set null,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_clover_employee_mappings_employee on public.clover_employee_mappings(employee_id);
alter table public.clover_employee_mappings enable row level security;
comment on table public.clover_employee_mappings is 'Owner-managed Clover to Operations Hub employee matching.';
