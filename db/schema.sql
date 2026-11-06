-- ClearPath ReviewOS schema (frozen v1): exactly three tables.
-- Safe to re-run: uses IF NOT EXISTS and never drops data.

create extension if not exists pgcrypto;

create table if not exists submissions (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 3 and 100),
  product_type text not null check (product_type in ('personal_loan', 'credit_card', 'mortgage_prequalification')),
  channel      text not null check (channel in ('affiliate', 'email', 'paid_social', 'landing_page')),
  partner_name text check (partner_name is null or char_length(partner_name) between 2 and 80),
  status       text not null default 'needs_review' check (status in ('needs_review', 'changes_requested', 'approved')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- partner name is stored only for affiliate submissions, and is required for them
  constraint submissions_partner_matches_channel check (
    (channel = 'affiliate' and partner_name is not null)
    or (channel <> 'affiliate' and partner_name is null)
  )
);

create table if not exists revisions (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references submissions (id),
  version_number  integer not null check (version_number >= 1),
  content         text not null check (char_length(content) between 10 and 5000),
  findings        jsonb not null default '[]'::jsonb,
  ruleset_version text not null default 'v1' check (ruleset_version = 'v1'),
  created_at      timestamptz not null default now(),
  unique (submission_id, version_number)
);

create table if not exists review_events (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id),
  revision_id   uuid references revisions (id),
  event_type    text not null check (event_type in ('submitted', 'changes_requested', 'resubmitted', 'approved')),
  actor_role    text not null check (actor_role in ('marketing', 'compliance', 'system')),
  note          text check (note is null or char_length(note) <= 1000),
  created_at    timestamptz not null default now()
);

create index if not exists submissions_status_created_idx on submissions (status, created_at);
create index if not exists revisions_submission_version_idx on revisions (submission_id, version_number desc);
create index if not exists review_events_submission_created_idx on review_events (submission_id, created_at desc);
