# On-device AI bugs (merge into docs/BUGLOG.md)

## BUG-ODAI-1: a slow photo job made every later photo miss the 6 s budget
- Date: 2026-10-10, 21:15 ET
- Area: hub (apps/hub/src/client.ts)
- Symptom: 5 photos sent one after another through the server all came back as the template (`tier: rules`, 6,014 to 6,110 ms round trip). The hub logged the jobs finishing at 7.4, 8.0, 8.3, 6.8 and 14.9 s.
- Cause: the Mac was loaded by nine agents (load average 16.7 on 10 cores), so one Gemma call took 6.0 s (prompt 1.9 s, 45 tokens in 4.1 s). The server stopped waiting at 6 s, but the hub kept working the old job and the next photo waited behind it, so each job started late.
- Fix: every hub job now gets the rest of its budget (6 s photo, 8 s ladder) counted from when it arrived; the Ollama call is aborted at 0 and a job already past its budget is answered `timeout` without calling Ollama. `npm run hub:field` also prints the load average.
- Proof: apps/hub/test/budget.test.ts (two 400 ms jobs with a 250 ms budget: both `timeout`, Ollama called once). Sunday's laptop must run nothing else; lab 02 measured 3.0 s per photo on an idle Mac.

## BUG-ODAI-2: AbortSignal.timeout() threw on a fractional budget
- Date: 2026-10-10, 21:20 ET
- Area: hub (apps/hub/src/client.ts)
- Symptom: after the BUG-ODAI-1 fix every job answered `model_unavailable`.
- Cause: the remaining budget was a fraction (performance.now() arithmetic) and Node's AbortSignal.timeout() accepts whole milliseconds only, so it threw before the call.
- Fix: Math.floor on the remaining budget.
- Proof: apps/hub tests 11/11 after the change (3 failed before it).
