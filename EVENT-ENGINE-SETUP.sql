-- Adventure Sports V10.0 Event Management + Registration Engine
-- Run once in Supabase SQL Editor before using the new Events & Signups module.

create extension if not exists pgcrypto;

create table if not exists public.event_catalog (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  slug text not null unique,
  title text not null,
  short_title text,
  description text not null default '',
  category text not null default 'Tournaments',
  sport text not null default '',
  event_kind text not null default 'Tournament',
  status text not null default 'draft' check (status in ('draft','published','cancelled','completed')),
  is_public boolean not null default true,
  featured boolean not null default false,

  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  timezone text not null default 'America/New_York',

  location_name text not null default 'Adventure Sports & Entertainment',
  location_address text not null default '515 Monmouth Rd, Building 200, Jackson Township, NJ 08527',

  price_display text not null default 'See event details',
  event_fee numeric(10,2),
  divisions jsonb not null default '[]'::jsonb,

  signup_mode text not null default 'internal' check (signup_mode in ('internal','external','none')),
  registration_type text not null default 'team' check (registration_type in ('team','individual')),
  registration_state text not null default 'auto' check (registration_state in ('auto','open','closed')),
  registration_open_at timestamptz,
  registration_close_at timestamptz,
  capacity integer check (capacity is null or capacity > 0),
  waitlist_enabled boolean not null default true,
  external_registration_url text,
  registration_questions jsonb not null default '[]'::jsonb,

  image_url text,
  logo_url text,
  banner_url text,
  admission_price text,
  admission_note text,
  rules_url text,
  waiver_url text,

  contact_name text,
  contact_email text,
  contact_phone text,

  seo_title text,
  seo_description text,
  admin_notes text,
  legacy_data jsonb not null default '{}'::jsonb,

  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint event_catalog_dates check (end_date >= start_date)
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_catalog(id) on delete cascade,
  registration_number text not null unique,
  registration_type text not null check (registration_type in ('team','individual')),
  status text not null default 'confirmed' check (status in ('pending','confirmed','waitlisted','cancelled')),
  division text,
  team_name text,
  organization_name text,
  participant_name text,
  registrant_name text not null,
  email text not null,
  phone text,
  city text,
  state text,
  roster jsonb not null default '[]'::jsonb,
  responses jsonb not null default '{}'::jsonb,
  notes text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_catalog_start_date_idx on public.event_catalog(start_date);
create index if not exists event_catalog_public_idx on public.event_catalog(is_public,status,start_date);
create index if not exists event_catalog_category_idx on public.event_catalog(category,start_date);
create index if not exists event_registrations_event_idx on public.event_registrations(event_id,created_at desc);
create index if not exists event_registrations_status_idx on public.event_registrations(event_id,status);
create index if not exists event_registrations_email_idx on public.event_registrations(lower(email));

-- These tables are intentionally accessed through the site's Netlify functions.
-- The browser never receives the Supabase service-role key.
alter table public.event_catalog enable row level security;
alter table public.event_registrations enable row level security;

-- No anon/authenticated policies are required. Netlify server functions use the
-- service role and bypass RLS. This prevents direct public table reads/writes.

comment on table public.event_catalog is 'Adventure Sports public events and registration configuration';
comment on table public.event_registrations is 'Adventure Sports team and individual event signups';
