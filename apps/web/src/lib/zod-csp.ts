// Our CSP forbids eval (SRS-SEC-6). Zod 4 probes for eval with `new Function` the first time
// it parses an object, and the browser reports that as a CSP violation even though zod
// catches it (BUG-029). Jitless mode skips the probe. Import this before any schema runs.
import { z } from "zod";

z.config({ jitless: true });
