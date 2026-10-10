# Flare: Business requirements (BRD)

Owner: Product. Version 1.0, Sat 2026-10-10. Input: founder brief (FLARE-SPEC v2), field scan (docs/research/00-challenge-and-field.md).

## 1. The problem

People don't stay inside for lack of places to go. They stay in because of five small frictions:

1. **Asking is awkward.** A public "who's in?" invites a public "no".
2. **Nobody wants to show up alone.** Without proof others will come, the safe choice is to stay home.
3. **Plans die in the group chat.** "Maybe later" never turns into a time and a place.
4. **Some friends can't use the spot.** Steps, distance between seats, no restroom. They quietly opt out.
5. **Phones lose signal exactly where the good places are.** The plan can't be checked or changed once you're there.

Every existing "go outside" app treats this as a one-person motivation problem. It is a coordination problem.

## 2. Who has it

- Friend groups of 3 to 8 who already chat (iMessage, WhatsApp, Telegram) and meet less than they say they want to.
- Inside those groups: the friend who never commits first, the friend who can't see the photo, the friend whose knee decides the route, and the host who is tired of asking.
- Our test group: four friends in Dearborn, Michigan, all on iPhones (13, 16 Pro Max, 17 Pro, 17 Pro Max). Two use Telegram, two use iMessage.

## 3. Evidence

| Claim | Number | Source | Checked |
| --- | --- | --- | --- |
| Young adults flake on plans | 68% of UK 18 to 34 year olds admit flaking; 78% say they've been flaked on | IPA / Opinium, 13 Mar 2025, https://ipa.co.uk/news/flaking-data/ | Fetched Oct 10. The founder's "45% have lied about why" is **not** on this page (45% is "weather" as an acceptable reason). Do not use it. |
| Loneliness is common | "Nearly half" of young adults report loneliness in an eight-country study | WashU, 6 Mar 2026, https://source.washu.edu/2026/03/nearly-half-of-young-adults-report-loneliness-in-eight-country-study/ | Headline fetched Oct 10 |
| Friends drive where people go | 65% of Snapchatters' visits to new places are to spots a friend visited in the past year (correlational) | Snap Newsroom, https://newsroom.snap.com/location-sharing-redefining-friends-connect | Fetched Oct 10 |
| Benches decide who goes out | Benches along a route raise the chance a mobility-impaired senior goes for a walk from 60% to 75% (healthy peers: 90%) | Netspar, https://www.netspar.nl/en/knowledge-hub/do-modern-cities-encourage-or-discourage-walking-of-health-impaired-seniors/ | Fetched Oct 10 |
| Face-to-face time is falling | Ages 15 to 24: about 61 to 35 min/day, 2003 to 2025 (ATUS) | Axios, https://www.axios.com/2026/07/05/americans-socializing-decline | **Not re-verified** (site returned 403). Cite only with that caveat or find the ATUS table. |
| Disability is common | 12.2% of US adults have a mobility disability, 5.5% a vision disability | CDC, https://www.cdc.gov/disability-and-health/articles-documents/disability-impacts-all-of-us-infographic.html | **Not re-verified** (403). Same rule. |
| No-signal texting exists | iPhone 14 or later can send iMessage or SMS via satellite (iOS 18+) | Apple, https://support.apple.com/en-us/120930 | Fetched Oct 10 |
| In-browser GPU on iPhone | Safari 26 adds WebGPU | WebKit, https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/ | Fetched Oct 10 |
| The test area has places to sit | Within 3 km of Fairlane Town Center (42.3233, -83.2105): 48 benches, 9 picnic tables, 6 restrooms, 1 drinking fountain, 22 parks | OpenStreetMap via Overpass, queried Oct 10 | Our query. The founder's count (54, 6, 2, 24) used a different centre or tag set. Engineering re-runs it for the offline pack. |

## 4. Goals

| # | Goal | Why |
| --- | --- | --- |
| G1 | Four real friends meet outside on Sunday because of a Flare, with the screen used for seconds | Proves the product does its one job |
| G2 | Win the Overall prize of DEV Hacktoberfest Week 1 | Business goal of this weekend |
| G3 | Every AI job runs on open models, on the phone when the phone can, and reports which tier ran | Prompt relevance and "why open" |
| G4 | Nothing personal is left behind, and we can prove it | Privacy promise is a product feature |
| G5 | A friend with low vision and a friend with limited mobility can join as equals | Inclusion is part of "nobody is left out" |

## 5. Success metrics and how we measure them

Definitions are in 07-kpis.md. Targets apply to the Sunday field test (11 AM to 3 PM ET, four people, four iPhones).

| Metric | Target Sunday | How measured |
| --- | --- | --- |
| Headcount per Lit Flare | 4 of 4 on at least one Flare | Host's arrival taps, stored as one integer per Flare |
| Light rate | At least 2 Flares created; at least 1 Lit | Server counters: created, lit |
| Ember save rate | Reported as measured, with n. At least one Ember is triggered on purpose to test it | Server counters: embers, embers lit |
| Screen seconds, invitee | Median 10 s or less from notification to "I'm in" | On-device timer, sent as one bucketed number |
| Screen seconds, host | Median 15 s or less from open to sent | Same |
| Time outside together | At least 45 min on the longest Flare | Lit time to host's "Done" |
| On-device AI | Tier that ran is logged for every AI job; on-phone tier runs on every phone that passes the capability check | Tier counter per job |
| Deletion | Audit after Gone returns 0 Flare records, 0 photo blobs, 0 conditions | Audit script output, pasted in the post |
| Accessibility | The full invite, yes, and compass flow completes with VoiceOver on | Field test with VoiceOver on one phone |
| Post | Published on DEV with the template and #hf26challenge before Mon 06:59 UTC | DEV URL |

## 6. Constraints

- **Deadline:** DEV submission by Sun Oct 11, 11:59 PM PDT (Mon 06:59 UTC). Release candidate by Sun 10 AM ET. Field test Sun 11 AM to 3 PM ET. Sunset 6:57 PM EDT.
- **Rules:** new project built in the window; one entry; commits after the deadline noted in the README; DEV template; English for prize eligibility.
- **Devices:** four iPhones, iOS versions unknown until Sunday morning. Tiers are picked by runtime capability checks, never by model name.
- **No hardware.** No accounts or passwords for end users.
- **Open models only** for AI jobs. Gemma 4 E2B (browser) and Gemma 4 E4B (Ollama on our Mac) are approved downloads.
- **Approvals:** every public deploy, public repo, post, upload or message to people needs the founder's yes, one at a time. Until then the Telegram bot may post only in the private "Flare test" group.
- **People in the post:** first names only (Fuego, Amor, Shilp, Ammo). No faces or voices unless each person says yes on the day.
- **Writing:** plain words, numbers for every claim, the banned-word list, UI copy limits (buttons 3 words, messages 12 words).
- **Less tech, more nature:** any feature that adds screen time needs a written reason.

## 7. Out of scope (business)

Money, payments or prizes in the product; accounts and passwords; feeds, followers, streaks, points, badges, comments, ratings; a "No" button; "prove you went outside"; AI-written itineraries; mesh radios or any hardware; Wikimedia content.
