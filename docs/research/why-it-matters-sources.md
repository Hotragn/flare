# "Why it matters": sources and exact figures

Every number in the home page section "Why it matters" (`apps/web/src/routes/(site)/Why.svelte`,
copy keys `site.why.*`). Each was read from the primary source on 2026-10-11; nothing is from
memory. Numbers that could not be checked against a primary source were dropped (listed at the end).

## Shown on the site

### Time indoors: 87% in buildings, 6% in vehicles

- Source: Klepeis NE, Nelson WC, Ott WR, Robinson JP, Tsang AM, Switzer P, Behar JV, Hern SC,
  Engelmann WH. "The National Human Activity Pattern Survey (NHAPS): a resource for assessing
  exposure to environmental pollutants." *J Expo Anal Environ Epidemiol* 2001;11(3):231-252.
  https://doi.org/10.1038/sj.jea.7500165 (PubMed 11477521; abstract read through NCBI E-utilities).
- Exact wording (abstract): respondents reported spending an average of 87% of their time in
  enclosed buildings and about 6% of their time in enclosed vehicles.
- Sample: 9,386 people, a probability-based telephone survey of the 48 contiguous US states, late
  September 1992 to September 1994, sponsored by the US EPA.
- On the site: "Buildings 87%", "Vehicles 6%", and "The rest, about 7%". The 7% is our arithmetic
  (100 - 87 - 6); the paper does not state it, so the label says "about" and "the rest".

### Time with friends: 60, 34, 20 minutes a day (2003, 2019, 2020)
### Time alone: 285, 309, 333 minutes a day (2003, 2019, 2020)

- Source: Kannan VD, Veazie PJ. "US trends in social isolation, social engagement, and
  companionship - nationally and by age, sex, race/ethnicity, family income, and work hours,
  2003-2020." *SSM - Population Health* 2023;21:101331. https://doi.org/10.1016/j.ssmph.2022.101331
  (PMC9811250; full text read from Europe PMC).
- Data: the American Time Use Survey (BLS), 2003 to 2020.
- Exact figures (section 3.2): time socially engaged with friends decreased from 60 min/day in 2003
  to 34 min/day in 2019 and 20 min/day in 2020. Time spent alone increased from 285 min/day in 2003
  to 309 min/day in 2019 and 333 min/day in 2020.
- This paper is the source the 2023 US Surgeon General advisory cites for the friends figures.

### Loneliness: 24% worldwide, 27% for ages 19 to 29

- Source: Gallup, "Almost a Quarter of the World Feels Lonely", Ellyn Maese, 24 October 2023,
  https://news.gallup.com/opinion/gallup/512618/almost-quarter-world-feels-lonely.aspx, from the
  Meta-Gallup Global State of Social Connections study.
- Exact figures: 24% of both men and women report feeling very or fairly lonely; young adults aged
  19 to 29: 27%.
- Sample: 142 countries and areas, about 1,000 people aged 15 and older per country, fieldwork June
  2022 to February 2023.
- On the site: "24% of people said they feel lonely". The copy lint bans the word "very" as filler,
  so the measure's wording ("very or fairly lonely") is behind the source link.

### Nature: 120 minutes a week

- Source: White MP, Alcock I, Grellier J, Wheeler BW, Hartig T, Warber SL, Bone A, Depledge MH,
  Fleming LE. "Spending at least 120 minutes a week in nature is associated with good health and
  wellbeing." *Scientific Reports* 2019;9:7730. https://doi.org/10.1038/s41598-019-44097-3
  (PubMed 31197192).
- Exact findings (abstract): compared to no nature contact last week, the likelihood of reporting
  good health or high well-being became significantly greater with contact of 120 min or more;
  it did not matter how the 120 min a week was achieved (one long or several shorter visits).
- Sample: 19,806 people, Monitor of Engagement with the Natural Environment survey (England),
  2014/15 to 2015/16.
- The site's closing line ("15 minutes outside with people you like. Eight of those make 120.") is
  arithmetic on this figure, not a claim from the paper.

## Checked and not used

- 2023 US Surgeon General advisory, "Our Epidemic of Loneliness and Isolation": hhs.gov returned
  403 to every fetch (PDF and press release) and the NCBI Bookshelf copy asked for a CAPTCHA, so its
  "about one in two US adults" figure was not read from the source and is not on the site. Its
  friends-time figures come from Kannan and Veazie, which was read directly (above).
- BLS ATUS yearly "socializing and communicating" table: not fetched (bls.gov blocks automated
  requests); the ATUS trend on the site comes from Kannan and Veazie's analysis of the same survey.
