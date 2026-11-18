-- Zaistech Audit OS -- Supabase (Postgres) schema
-- Run this once in the Supabase SQL editor to create the tables.
-- Matches the data model in the "Zaistech Audit OS -- Build Plan" doc.

create extension if not exists "pgcrypto";

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  title text,
  email text,
  company text not null,
  domain text not null unique,
  employees text,
  industry text,
  city text,
  state text,
  country text,
  linkedin text,
  instagram text,
  sheet_row_id text,
  status text not null default 'new', -- new | auditing | needs_review | audited | demo_ready | outreach_sent | replied | won | lost
  owner text,
  next_action text,
  next_action_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audits (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  run_at timestamptz not null default now(),
  rulebook_version text,
  platform text,
  apps_detected jsonb,
  status jsonb,           -- per-step status: {"homepage_scan":"done","pagespeed":"done", ...}
  raw jsonb,              -- raw script output, kept for debugging/trust
  approved boolean not null default false,
  approved_at timestamptz,
  approved_by text
);

create table if not exists findings (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  area text not null,      -- email | chat | reviews | pdp | seo | speed | checkout | upsells | ads | business_specific
  what text not null,
  where_ text,
  why text,
  fix text,
  service text,
  priority int default 0,
  evidence_url text,
  source text default 'auto', -- auto | user
  included boolean default true
);

create table if not exists strengths (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  text text not null,
  source text default 'auto'
);

create table if not exists metrics (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  page text,
  device text,
  pagespeed_score int,
  lcp text,
  inp text,
  cls text,
  tbt text,
  speed_index text,
  requests int,
  page_weight_kb int
);

create table if not exists inbox_checks (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  kind text not null,      -- welcome | abandoned_cart
  audit_address text,
  triggered_at timestamptz,
  due_at timestamptz,
  result jsonb,
  verdict text             -- missing | weak | good | not_applicable
);

create table if not exists demos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  plan text,
  status text default 'proposed', -- proposed | approved | built | sent
  file_links jsonb,
  sent_at timestamptz
);

create table if not exists outreach (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  channel text not null,   -- email | linkedin | instagram
  step text not null,      -- first | follow_up_1 | follow_up_2
  subject text,
  body text not null,
  status text default 'draft', -- draft | approved | sent | replied
  sent_at timestamptz,
  sequencer_id text
);

create table if not exists rulebook_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  text text not null,
  changed_by text,
  change_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audits_lead on audits(lead_id);
create index if not exists idx_findings_audit on findings(audit_id);
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_domain on leads(domain);
