-- Columns and indexes the engine mapping needs (docs/backend/01-service-design.md).
-- checks_at: when the phone last sent pass/fail per label (ICD-1 Answer.checks_at, BR-E-4).
alter table responses add column checks_at timestamptz;
-- One pending job per kind per gathering: schedule replaces, unschedule deletes.
create unique index jobs_one_per_kind on jobs(gathering_id, kind);
create index responses_gathering on responses(gathering_id);
create index spark_tickets_expiry on spark_tickets(expires_at);
create index idempotency_expiry on idempotency(expires_at)
