-- Flare schema v1 (docs/architecture/06-erd-and-data-dictionary.md).
-- Rules: no readable names, places or coordinates (ADR-0009); every per-gathering row
-- has expires_at and is removed by ON DELETE CASCADE from gatherings plus the sweeper
-- (ADR-0004, BR-D-1, BR-D-2). ct = AES-256-GCM ciphertext made on a phone.

create table groups (
  id uuid primary key,
  channel text not null default 'link' check (channel in ('link', 'telegram')),
  telegram_chat_id bigint unique,
  created_at timestamptz not null default now(),
  last_gathering_at timestamptz
);

create table members (
  id uuid primary key,
  group_id uuid not null references groups(id) on delete cascade,
  name_ct bytea, -- null for a member the bot made from a Telegram tap
  write_token_hash bytea, -- null until a Telegram member binds a phone
  via text not null default 'link' check (via in ('link', 'telegram')),
  telegram_user_id bigint,
  joined_at timestamptz not null default now(),
  unique (group_id, telegram_user_id)
);
create index members_group on members(group_id);

create table gatherings (
  id uuid primary key,
  group_id uuid not null references groups(id) on delete cascade,
  kind text not null check (kind in ('flare', 'plan')),
  state text not null check (state in ('kindling', 'lit', 'ember', 'gone')),
  short_code text not null,
  host_member_id uuid not null references members(id) on delete cascade,
  quorum smallint not null check (quorum between 2 and 6),
  tz text not null,
  version integer not null default 1,
  state_since timestamptz not null default now(),
  ended text check (ended in ('not_this_time', 'thanks_for_coming')),
  sealed bytea not null,
  notice_ct bytea not null,
  -- Readable post text, Telegram groups only (ADR-0013). Deleted with the row at Gone.
  telegram_plain jsonb,
  text_yes smallint not null default 0 check (text_yes between 0 and 3),
  -- Opaque labels c1..c12 in distance order; the places are only in `sealed` (ADR-0009).
  ember_candidates text[] not null default '{}',
  ember_choice text,
  plan_steps jsonb, -- [{step, minutes, place label}] for Plans
  current_step smallint check (current_step is null or current_step between 1 and 4),
  chosen_set uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  deadline_at timestamptz,
  start_at timestamptz,
  lit_at timestamptz,
  done_at timestamptz,
  headcount smallint,
  expires_at timestamptz not null
);
create unique index gatherings_live_code on gatherings(short_code) where state <> 'gone';
create index gatherings_expiry on gatherings(expires_at);

create table photos (
  gathering_id uuid primary key references gatherings(id) on delete cascade,
  ct bytea not null,
  expires_at timestamptz not null
);

create table responses (
  id uuid primary key,
  gathering_id uuid not null references gatherings(id) on delete cascade,
  -- Anonymous text yeses (BR-ID-6) are only counted in gatherings.text_yes; every row here has a member.
  member_id uuid not null references members(id) on delete cascade,
  status text not null check (status in ('yes', 'taken_back', 'cant_make_it')),
  ember_only boolean not null default false,
  rules jsonb not null default '[]',
  spot_checks jsonb not null default '{}',
  faded boolean not null default false,
  still_coming boolean not null default false, -- OQ-2, ADR-0016
  arrived_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (gathering_id, member_id)
);

create table jobs (
  id uuid primary key,
  gathering_id uuid not null references gatherings(id) on delete cascade,
  kind text not null check (kind in ('ember', 'ember_pick', 'gone', 'plan_deadline', 'delete')),
  due_at timestamptz not null,
  expires_at timestamptz not null
);
create index jobs_due on jobs(due_at);

create table bot_messages (
  gathering_id uuid not null references gatherings(id) on delete cascade,
  chat_id bigint not null,
  message_id bigint not null,
  expires_at timestamptz not null,
  primary key (chat_id, message_id)
);

create table live_locations (
  gathering_id uuid not null references gatherings(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  ct bytea not null,
  at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (gathering_id, member_id)
);

create table push_subscriptions (
  member_id uuid primary key references members(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table sparks (
  id uuid primary key,
  group_id uuid not null references groups(id) on delete cascade,
  place_key_hash bytea not null,
  text_ct bytea not null,
  delete_token_hash bytea not null, -- lets the writer delete it; no author id kept
  created_on date not null default current_date
);
create index sparks_group_place on sparks(group_id, place_key_hash);

-- Issued when an "I'm here" is accepted (BR-K-1). Belongs to the group, not the gathering,
-- because the gathering is deleted within 5 minutes of Gone. No member id.
create table spark_tickets (
  token_hash bytea primary key,
  group_id uuid not null references groups(id) on delete cascade,
  expires_at timestamptz not null
);

create table hotspots (
  group_id uuid primary key references groups(id) on delete cascade,
  blob_ct bytea not null,
  version integer not null default 1
);

create table counters (
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  bucket text not null default '',
  value bigint not null default 0,
  primary key (group_id, name, bucket)
);

-- Global totals such as tier_ran.photo.hub (BR-AI-3); no group, no time.
create table global_counters (
  name text not null,
  bucket text not null default '',
  value bigint not null default 0,
  primary key (name, bucket)
);

-- One-time tokens: t.me startgroup links and personal bind links (ADR-0013). Hashes only.
create table telegram_links (
  token_hash bytea primary key,
  group_id uuid not null references groups(id) on delete cascade,
  expires_at timestamptz not null
);

create table telegram_binds (
  token_hash bytea primary key,
  gathering_id uuid not null references gatherings(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  expires_at timestamptz not null
);

-- Key is "{memberId or 'anon'}:{Idempotency-Key}", so two phones can't collide. 24 h.
create table idempotency (
  key text primary key,
  response jsonb not null,
  expires_at timestamptz not null
);
