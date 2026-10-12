# Share matrix (host's Share, Copy link, Tell the chat)

Founder bug, 2026-10-11: Brave on an iPhone, WhatsApp Business only. Neither Share nor the
WhatsApp path opened anything.

Cause in our code: after Send, `HostPage.send()` awaited the seal and the POST, then called
`flow.share()`. By then WebKit had dropped the tap's activation, so `navigator.share` rejected
with `NotAllowedError`, and `share()` swallowed every error. Nothing showed on screen.

The fix:

- Send makes the Flare and opens no sheet.
- On H4, Share is the main button. Its tap calls `navigator.share` with a link that is already
  built, before any await.
- AbortError (the host closed the sheet) is quiet. Any other failure shows a toast ("Share did
  not open. Tap Copy link.") and turns Share into Copy link.
- With no `navigator.share`, Copy link shows from the start. It writes with
  `navigator.clipboard` and shows "Link copied. Paste it in your chat."
- When Telegram is linked, the server still posts the card (`postedToTelegram`). H4 keeps Pocket
  it as the main button there.

There is no direct WhatsApp button in the app (`git grep "wa.me\|whatsapp:"` finds nothing), so
the wa.me plus 1.5 s visibility fallback was not built. The e2e test checks that any WhatsApp
control is an `<a href="https://wa.me/...">` (0 found).

## What ran

`node apps/web/test/e2e/share.ts` (after `npm run build`): real server, real hub, PGlite.
`navigator.share` and the clipboard are stubbed in an init script. Every API call is delayed by
1.5 s, so Send has a real await before the Share step. The run used Chrome (installed channel) and
Playwright WebKit 2370 (desktop WebKit on macOS, not iOS). 27 checks (14 Chrome, 13 WebKit), all pass. Checked in each
browser:

- slow Send makes no share call
- Share comes before Pocket it
- Share calls `navigator.share` inside the click, with no fetch between the click and the call
- the shared URL is the Flare link
- AbortError keeps Share and shows no Copy link
- NotAllowedError shows the toast and Copy link, and Copy link writes the link
- with no share, Copy link writes the link (Chrome also read back the real clipboard)
- axe on H4 with Copy link and the toast: 0

The unit tests in `apps/web/test/flow/host.test.ts` (4 share tests) cover the same logic.

## Matrix

Every cell says what was tested. No cell was run on a real iPhone. The stub cannot show the iOS
share sheet, which apps appear in it, or whether WhatsApp or WhatsApp Business opens.

| Browser, iOS | WhatsApp installed | WhatsApp Business only |
|---|---|---|
| Safari, iOS 17 | Not on a device. Logic tested in Playwright WebKit (desktop) with a stub. | Not on a device. Same WebKit stub run. Which apps show in the sheet is up to iOS, not tested. |
| Safari, iOS 18 | Not on a device. Same WebKit stub run. | Not on a device. Same WebKit stub run. |
| Brave, iOS 17 | Not on a device. Brave on iOS uses WebKit, so the WebKit stub run is the nearest check. Brave's own share and clipboard handling were not tested. | Not on a device. Same as left. This is the founder's setup and still needs a real-device check. |
| Brave, iOS 18 | Not on a device. Same as above. | Not on a device. Same as above. |

## Still to test on a real iPhone

1. Light a Flare, Send, then tap Share on H4. The sheet should open, and WhatsApp Business should
   appear in it.
2. Pick WhatsApp Business. The message should hold the text and the link.
3. In Brave, check whether `navigator.share` is there. If it is missing, Copy link should show and
   the paste should work.
4. At Lit, tap Tell the chat and check the same things.
