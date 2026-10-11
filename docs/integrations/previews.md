# Link previews (iMessage, WhatsApp, Telegram)

`mountPreview(app, { need, publicBaseUrl, webBuildDir })` in `apps/server/src/preview/index.ts`. Decision: ADR-0017 (variant `safe`). Requirement: SRS-CH-7.

`GET /g/{uuid}` and `/g/{uuid}/` return the SPA shell (`200.html`) with these tags put right after `<head>`. The shell's own title, description, Open Graph and Twitter tags are removed so crawlers see one set.

| Tag | Value |
| --- | --- |
| `<title>`, `og:title`, `twitter:title` | [og.link.safe.title] "A Flare from a friend" |
| `og:description`, `twitter:description`, `description` | [og.link.safe.desc] "Need {n} more. Open it to say yes in private." Left out when the Flare is Gone or unknown |
| `og:image`, `og:image:secure_url`, `twitter:image` | `{PUBLIC_BASE_URL}/og/flare-card-1200x630.jpg` |
| `og:image:type`, `:width`, `:height` | `image/jpeg`, 1200, 630 |
| `og:url` | `{PUBLIC_BASE_URL}/g/{id}` (no `#k=` fragment: browsers never send it) |
| `twitter:card` | `summary_large_image` |
| `robots` | `noindex` |

No photo, invite words, place or host name is ever in the tags. Previews are cached on Apple's, Meta's and Telegram's servers where our deletion can't reach, so the only thing left there after Gone is a count.

## What each crawler needs, and the test for it

| Need | Why | Test (preview.test.ts) |
| --- | --- | --- |
| Tags in the first 4 KB | WhatsApp reads only the start of the page | 30 KB shell, tags found in `html.slice(0, 4096)` |
| Image under 300 KB | WhatsApp drops larger preview images | the card is 92,803 bytes |
| Image 1200 x 630 JPEG with a correct `Content-Length` | large card layout in iMessage and Telegram | size read from the JPEG SOF marker |
| Absolute https image URL | all three ignore relative URLs | `og:image` starts with `PUBLIC_BASE_URL` |
| Title under 60, description under 155 characters | none of them cut it | length checks |
| HEAD answered | some fetchers check first | HEAD returns 200 |
| Same answer for each user agent | iMessage (`facebookexternalhit/1.1 Facebot Twitterbot/1.0`), WhatsApp (`WhatsApp/2.x`), Telegram (`TelegramBot (like TwitterBot)`) | one test per agent |

The card is the brand OG image (`brand/export/social/og-image-1200x630.png`, 740 KB PNG) saved as an 85-quality JPEG with `sips`; the PNG is too big for WhatsApp.

HTML gets `Cache-Control: no-cache` so a refetch shows the new count, and the same CSP as the rest of the app with the shell's inline script hash.
