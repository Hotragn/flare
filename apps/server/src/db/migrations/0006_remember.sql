-- Remember this (ADR-0031): a conversation note made only with everyone's consent. Both tables
-- cascade with their gathering, so a Flare's note is deleted with it at Gone (deletion audit DS12).
create table remember (
  gathering_id uuid primary key references gatherings(id) on delete cascade,
  on_by_host boolean not null default false,
  recording_until timestamptz,
  note_ct bytea, -- sealed on the phones with the Flare key; the server can't read it
  updated_at timestamptz not null default now()
);
create table remember_consent (
  gathering_id uuid not null references gatherings(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  ok boolean not null,
  primary key (gathering_id, member_id)
);
