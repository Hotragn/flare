-- Partial index for the sweeper (spike E2: plan cost 242 -> 12.6, 100-gathering sweep
-- 35.9 ms -> 21.4 ms on PGlite). Only Gone rows are indexed, so it stays tiny.
create index gatherings_gone on gatherings(state_since) where state = 'gone'
