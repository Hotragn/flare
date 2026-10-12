# "Why it matters": sources and exact figures

Every number in the home page section "Why it matters" (`apps/web/src/routes/(site)/Why.svelte`,
copy keys `site.why.*`). Each was read from its primary source on 2026-10-11 (second pass, newest
data); nothing is from memory. Anything that could not be read at the source is listed at the end
and is not on the site.

## Shown on the site

### 1. Socializing on an average day, 2015 and 2025 (newest)

- Source: US Bureau of Labor Statistics, "American Time Use Survey - 2025 Results", news release
  USDL-26-1022, for release 10:00 a.m. (ET) Thursday, June 25, 2026.
  https://www.bls.gov/news.release/archives/atus_06252026.htm (read with WebFetch; curl from this
  machine gets "Access Denied" from bls.gov).
- Exact wording: "People were less likely to engage in socializing and communicating on an average
  day in 2025 than in 2015--30 percent compared with 38 percent. They also spent less time in these
  activities in 2025 than in 2015--35 minutes compared with 41 minutes. (See tables 1 and 11A.)"
- What the minutes mean: Table 1 gives socializing and communicating as 0.58 hours a day (about 35
  minutes) for the whole civilian population, 30.4% engaged on an average day, and 1.92 hours a day
  for people who engaged. So 35 and 41 minutes are averages over **everyone**, not over the people
  who socialized. The brief described them as "time among those who did"; that is not what the
  release says, so the chart labels them "Minutes a day, everyone".
- The release's own caveat (box "Federal Government Shutdown"): "All American Time Use Survey (ATUS)
  operations were suspended from October 1 through November 12." "No call attempts were made and
  no interviews were completed during the shutdown." "Data collection resumed on November 13."
  "It is not possible to quantify the effect of the shutdown on the ATUS estimates." The site's
  footnote: "No interviews took place from October 1 to November 12, 2025, during the federal
  shutdown. BLS says it can't measure the effect."

### 2. Time with friends and time alone, 2003, 2019, 2020 (latest published analysis)

- Source: Kannan VD, Veazie PJ. "US trends in social isolation, social engagement, and
  companionship - nationally and by age, sex, race/ethnicity, family income, and work hours,
  2003-2020." *SSM - Population Health* 2023;21:101331. https://doi.org/10.1016/j.ssmph.2022.101331
  (PMC9811250; full text read from Europe PMC).
- Data: the American Time Use Survey, 2003 to 2020.
- Exact figures (section 3.2): time socially engaged with friends "decreased overall from 60-min/day
  in 2003 to 34-min/day in 2019 and continued to decrease to 20-min/day in 2020"; time spent alone
  "increased from 285-min/day in 2003 to 309-min/day in 2019 and continued to increase to
  333-min/day in 2020".
- On the site: labelled "Latest published analysis", not extended past 2020. "Fell by two thirds"
  is 60 to 20 (a drop of 40 of 60 minutes). The 2020 point is labelled "pandemic" (ATUS collection
  was suspended mid-March to mid-May 2020, per bls.gov/tus/data/datafiles-0325.htm).
- The paper states only these three years in its text, so the chart plots only those three points.

### 3. Time indoors, 1992 to 1994 (kept: no verified newer replacement)

- Source: Klepeis NE, et al. "The National Human Activity Pattern Survey (NHAPS): a resource for
  assessing exposure to environmental pollutants." *J Expo Anal Environ Epidemiol*
  2001;11(3):231-252. https://doi.org/10.1038/sj.jea.7500165 (PubMed 11477521, abstract read through
  NCBI E-utilities).
- Exact wording: "NHAPS respondents reported spending an average of 87% of their time in enclosed
  buildings and about 6% of their time in enclosed vehicles."
- Sample: 9,386 people, telephone survey, late September 1992 to September 1994.
- On the site the title states the years ("In 1992 to 1994, Americans spent 87% of their time in
  buildings"). "The rest, about 7%" is our arithmetic (100 - 87 - 6), labelled as such.
- Replacement considered: our own ATUS series on time outdoors away from home (TEWHERE), which
  needs the microdata below. Not downloaded, so NHAPS stays.

### 4. Loneliness (replaces Gallup/Meta 2023)

- Source: World Health Organization, news release "Social connection linked to improved health and
  reduced risk of early death", 30 June 2025, on the WHO Commission on Social Connection's global
  report.
  https://www.who.int/news/item/30-06-2025-social-connection-linked-to-improved-heath-and-reduced-risk-of-early-death
- Exact wording: "1 in 6 people worldwide is affected by loneliness". "Loneliness is linked to an
  estimated 100 deaths every hour—more than 871 000 deaths annually."
- On the site: "1 in 6 people worldwide is affected by loneliness" (WHO's own words) and "WHO links
  loneliness to more than 871,000 deaths a year, about 100 every hour." Note: WHO says "more than
  871 000", not "about".
- Not used but on the page: 17-21% of people aged 13-29 reported feeling lonely; about 24% in
  low-income countries against about 11% in high-income countries.

### 5. 120 minutes a week in nature (kept)

- Source: White MP, et al. "Spending at least 120 minutes a week in nature is associated with good
  health and wellbeing." *Scientific Reports* 2019;9:7730. https://doi.org/10.1038/s41598-019-44097-3
  (PubMed 31197192).
- Exact findings (abstract): the likelihood of reporting good health or high well-being "became
  significantly greater with contact ≥120 mins"; "It did not matter how 120 mins of contact a week
  was achieved (e.g. one long vs. several shorter visits/week)."
- Sample: 19,806 people, Monitor of Engagement with the Natural Environment survey (England),
  2014/15 to 2015/16.
- "Eight Flares make 120." is arithmetic on this figure (8 x 15 min), not a claim from the paper.

## Our own 2003-2025 series: files needed (not downloaded)

The founder has not approved downloads yet, so none of these were fetched. From
https://www.bls.gov/tus/data/datafiles-0325.htm ("American Time Use Survey—2003-2025 Microdata
files"; the page says the files are CSV inside ZIP):

| File | What we need it for | Size on the page |
| --- | --- | --- |
| https://www.bls.gov/tus/datafiles/atusact-0325.zip | Activity file: each activity with its start and stop times and location (TEWHERE), for time outdoors away from home | 81.5 MB |
| https://www.bls.gov/tus/datafiles/atuswho-0325.zip | Who file: who was present during each activity (friends) | 20.8 MB |
| https://www.bls.gov/tus/datafiles/atusresp-0325.zip | Respondent file: the final weight (TUFINLWGT) and year, to make population estimates | 16.3 MB |
| https://www.bls.gov/tus/dictionaries/atusintcodebk0325.pdf | Interview data dictionary (variable codes for TEWHERE and who-was-present) | not printed |
| https://www.bls.gov/tus/lexicons/lexiconnoex0325.pdf | 2003-2025 coding lexicon (activity codes) | not printed |

Total for the three data files: 118.6 MB. Optional for standard errors: atuswgts-0325.zip
(replicate weights, 292.6 MB) and atuswgtspan-1920.zip (pandemic replicate weights 2019-20,
56.1 MB). Not needed: atuscps-0325.zip (101.5 MB), atusrost-0325.zip (3.2 MB), atussum-0325.zip
(15.8 MB, totals by activity without location or company), atusrostec-1125.zip (0.2 MB),
atuscase-0525.zip (5.3 MB).

## Checked and not used

- Gallup and Meta, Global State of Social Connections (2023): replaced by the WHO 2025 report.
- 2023 US Surgeon General advisory: hhs.gov returned 403 to every fetch and the NCBI Bookshelf copy
  asked for a CAPTCHA, so none of its own figures are used. Its friends-time figures come from
  Kannan and Veazie, read directly.
- BLS 2016-2024 yearly values for socializing: not read (each needs its own release page), so the
  chart shows only the two years the 2025 release compares.
