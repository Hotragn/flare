-- Automations: the engine schedules a "plan_reminder" job 30 min before a lit Plan starts.
alter table jobs drop constraint if exists jobs_kind_check;
alter table jobs add constraint jobs_kind_check check (kind in ('ember', 'ember_pick', 'gone', 'plan_deadline', 'plan_reminder', 'delete'));
