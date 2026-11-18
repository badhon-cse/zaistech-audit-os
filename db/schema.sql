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
  included boolean default true,
  crop_rect jsonb,          -- {top,left,width,height} in the matching page screenshot's pixel space, when a Lighthouse audit item pinpointed this exact element
  screenshot_source text,   -- 'homepage' | 'product' | 'checkout' -- which metrics row's screenshot crop_rect refers to
  demo_html text,           -- AI-generated self-contained HTML mockup showing the fix for this specific finding
  demo_generated_at timestamptz
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
  page_weight_kb int,
  seo_score int,
  accessibility_score int,
  top_opportunities jsonb,
  screenshot_base64 text,   -- real rendered FULL-PAGE screenshot from PageSpeed/Lighthouse, data: URI -- captured at END of trace, may show an on-page popup
  preview_screenshot_base64 text, -- early filmstrip frame (screenshot-thumbnails), popup-free in most cases -- used as the page's header/preview image
  screenshot_width int,     -- pixel width of screenshot_base64, for cropping element rects to %
  screenshot_height int,    -- pixel height of screenshot_base64
  element_issues jsonb,     -- [{audit, label, rect:{top,left,width,height}}] -- specific elements Lighthouse flagged, with pixel coords when available
  page_issues jsonb         -- for product page: issues[] from parseProductPage (reviews/guarantee/etc missing)
);

create table if not exists inbox_checks (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  kind text not null,      -- welcome | abandoned_cart
  audit_address text,
  triggered_at timestamptz,
  due_at timestamptz,
  result jsonb,
  verdict text             -- missing | unconfirmed (heuristic only, no live test run) |
                            -- unconfirmed_pending (live test triggered, awaiting due_at) |
                            -- good | weak | not_applicable (final, from /api/inbox-checks/poll)
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

-- Self-improvement loop: AI-drafted edits to the rulebook, based on which
-- past findings correlated with a real outcome (lead.status reaching
-- replied/won vs lost/no response) and which findings a human removed
-- before sending (findings.included=false -- a direct "this was weak"
-- signal even without a final outcome yet). Never applied automatically --
-- a human reviews and approves/rejects each proposal; only on approval does
-- it become a new live rulebook_versions row.
create table if not exists rulebook_proposals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending', -- pending | approved | rejected
  based_on_version text,       -- rulebook_versions.version this proposal edited from
  proposed_text text not null, -- full replacement rulebook+kb text
  summary text,                -- short human-readable list of what changed and why
  evidence jsonb,               -- [{lead_id, company, outcome, note}] audits used as evidence
  lead_count int default 0,     -- how many outcome-tagged leads this proposal was based on
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text,
  applied_version text          -- rulebook_versions.version created on approval
);

create index if not exists idx_audits_lead on audits(lead_id);
create index if not exists idx_findings_audit on findings(audit_id);
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_domain on leads(domain);
create index if not exists idx_rulebook_proposals_status on rulebook_proposals(status);
