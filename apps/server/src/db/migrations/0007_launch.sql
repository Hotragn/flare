-- Since launch (Oct 11): six public totals, increment only, no ids, no names, no times per event,
-- no groups. Test traffic (smoke, e2e) marks its group with x-flare-test: 1 and never counts.
alter table groups add column is_test boolean not null default false;
create table launch_counters (
  metric text primary key,
  value bigint not null default 0
);
create table launch_meta (
  id int primary key default 1 check (id = 1),
  since timestamptz not null default now()
);
insert into launch_meta (id) values (1);
