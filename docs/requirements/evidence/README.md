# Evidence: pinned numbers and verified sources

Checked Sat 2026-10-10 by the analyst. Every number the app, docs or post cites about the world comes from this file.

## Fairlane amenities (pinned)

- Query: [fairlane-pinned.overpassql](fairlane-pinned.overpassql). Raw result: [fairlane-pinned-result.json](fairlane-pinned-result.json).
- Centre: OSM way 168151050 (`shop=mall`, "Fairlane Town Center"), centroid 42.3169092, -83.2229394. Radius 3,000 m. All element types (`nwr`).
- Endpoint: overpass-api.de, OSM data timestamp `2026-10-10T17:07:36Z`. The first three attempts returned "server too busy"; the fourth succeeded (see BUG-004).

| Tag | Count |
| --- | --- |
| `amenity=bench` | 54 |
| `leisure=picnic_table` | 7 |
| `amenity=toilets` | 7 |
| `amenity=drinking_water` | 3 |
| `leisure=park` | 32 |
| `highway=steps` | 28 |

Citable sentence: "Within 3 km of Fairlane Town Center, OpenStreetMap lists 54 benches, 7 public restrooms and 3 drinking fountains (Oct 10, 2026)."

Earlier numbers are superseded: the product draft's 48/9/6/1/22 used a centre 1.2 km away and nodes only; the founder's 54/6/2/24 used an unknown centre.

## Sources

| Claim | Status | Primary source | Exact figure |
| --- | --- | --- | --- |
| Fewer people socialize | **Verified** | BLS, American Time Use Survey 2025 Results, https://www.bls.gov/news.release/atus.nr0.htm (read in a browser Oct 10; scripted fetch gets 403) | "People were less likely to engage in socializing and communicating on an average day in 2025 than in 2015--30 percent compared with 38 percent." |
| Ages 15 to 24 face-to-face socializing fell from about 61 to 35 min/day, 2003 to 2025 | **Unverified** | Not in the BLS release; Axios returns 403 | Do not cite. Use the BLS line above. |
| Mobility disability | **Verified** | CDC Disability and Health Data System, BRFSS 2022, US, adults 18+, age-adjusted; Socrata dataset `s2qv-b27b` on data.cdc.gov | 12.2% (95% CI 12.0 to 12.4). Michigan: 11.8% |
| Vision disability | **Verified** | Same dataset | 5.5% (95% CI 5.3 to 5.7). Michigan: 4.6% |
| Flaking | **Verified** | IPA / Opinium, 13 Mar 2025, https://ipa.co.uk/news/flaking-data/ | 68% of UK 18 to 34s admit flaking; 78% say they've been flaked on |
| "45% lied about why" | **Not found** | Same page | Do not cite |
| Loneliness | **Verified (headline)** | WashU, 6 Mar 2026, https://source.washu.edu/2026/03/nearly-half-of-young-adults-report-loneliness-in-eight-country-study/ | "Nearly half" of young adults, eight countries |
| Friends drive new visits | **Verified** | Snap Newsroom, https://newsroom.snap.com/location-sharing-redefining-friends-connect | 65% of Snapchatters' visits to new places are to spots a friend visited in the past year (correlational) |
| Benches and seniors | **Verified** | Netspar, https://www.netspar.nl/en/knowledge-hub/do-modern-cities-encourage-or-discourage-walking-of-health-impaired-seniors/ | Benches raise the chance a mobility-impaired senior walks from 60% to 75% (healthy peers 90%) |
| Satellite texting | **Verified** | Apple, https://support.apple.com/en-us/120930 | iPhone 14 or later, iOS 18+, iMessage or SMS via satellite |
| WebGPU in Safari | **Verified** | WebKit, https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/ | Safari 26 adds WebGPU |
| MongoDB SSPL | **Verified** | MongoDB SSPL FAQ, https://www.mongodb.com/legal/licensing/server-side-public-license/faq | "The SSPL has not been approved by the OSI." |
| Sunset Sunday | **Computed** | NOAA sunrise equation at 42.31 N, 83.22 W | About 6:57 PM EDT, Oct 11, 2026 |
