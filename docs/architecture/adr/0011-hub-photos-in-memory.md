# ADR-0011: Photos for the AI live only in memory

Status: Accepted. Date: 2026-10-10. Answers question 5 of handoff 06 with the founder's lean.

## Context
To write six words the photo must be readable by the model, so it leaves the phone unsealed (FR-AI-1). The privacy page should be able to say "and it isn't stored".

## Decision
- The phone sends a separate 768 px JPEG (quality 0.7) to `POST /api/v1/drafts`. The sealed photo for friends is a different upload.
- **Server:** reads the body into one `Uint8Array` (at most 1.5 MB, JPEG magic bytes checked), sends it down the hub socket, and zero-fills it in a `finally` block. It is never logged (the request logger records method, route template, status and time only), never written to disk, never in the database.
- **Hub:** takes the binary frame, base64-encodes it for Ollama's `/api/chat` in memory, zero-fills its byte buffer after the call, and imports neither `node:fs` nor `node:child_process`. The base64 copy is a JavaScript string, which cannot be wiped; it goes out of scope after the call and is garbage-collected.
- **Ollama:** runs on localhost, `stream:false`. It keeps no request history on disk; its log at default level records method, path, status and time.

## Proof
`apps/hub/test/hub.test.ts`:
1. reads the hub's source and fails if it imports `node:fs`, `fs`, or `node:child_process`;
2. runs a job end to end against a fake Ollama and checks the request had `think:false` and the image;
3. checks no new file appeared in the OS temp folder during the job.
`apps/server/test/app.test.ts` checks the draft route answers and the buffer path returns the template when the hub is absent.

## Consequences
- The privacy page and `privacy.photoHub` copy can say: "To write the six words, your photo goes to our laptop over an encrypted link. It isn't stored."
- Swap or a crash dump could still hold bytes from memory; we say "isn't stored", not "can't be recovered".
