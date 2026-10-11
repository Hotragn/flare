# Datasheet: photos (photo and osm-tags evals)

**What.** 20 outdoor photos of meetup-type spots (park paths, benches, a fountain, a shelter, a food truck, a mall entrance, a group on a lawn). The lab picked them for spikes 01 and 02 from 24 candidates and dropped 4 (archival skyline, window close-up, satellite view, indoor mural). The set matches SRS-AI-3 ("20 test photos, including people in frame"): 6 have people in frame.

**Where from.** Wikimedia Commons, fetched by `lab/spikes/common/fetch-photos.mjs`, 1024 px on the long side. Manifest: `lab/data/photos/photos.json`.

**Licenses.** Per item below. We do **not** copy the images into this repo, the app or the website: the harness reads them in place from `lab/data/photos` (found through git's common dir, or `FLARE_LAB_DIR`). Reports store only the item id and our model's text. If a photo is ever shown publicly, credit the author and license as listed and keep BY-SA terms for any edited copy.

**Labels.** `evals/datasets/photos.json`: `expect_any` (key facts; any one counts), `names_ok` (sign text visible in the photo, so not invented), `people` (person in frame, from the lab's notes). `evals/datasets/osm-tags.json`: required tags for 5 photos. One labeller (the ML engineer), working from the lab's hand grades, so treat the key-fact score as a proxy.

**Known gaps.** No Fairlane photos taken by us yet (field test Sun 2026-10-11). No night or rain photos of Dearborn. Every model we tried misreads the dog park sign (p16).

**Privacy.** No faces, names or person attributes appear in any label.

| Id | Title (Wikimedia Commons) | Author | License | People in frame | Used for |
| --- | --- | --- | --- | --- | --- |
| 01 | [Fairlane Entrance.jpg](https://commons.wikimedia.org/wiki/File:Fairlane_Entrance.jpg) | Anne B. Hood / Annebethmi at en.wikipedia | Public domain | no | photo |
| 02 | [Powerhouse, Fair Lane (Clara and Henry Ford Mansion), Fair Lane Drive, Fairlane, Dearborn, MI.jpg](https://commons.wikimedia.org/wiki/File:Powerhouse,_Fair_Lane_(Clara_and_Henry_Ford_Mansion),_Fair_Lane_Drive,_Fairlane,_Dearborn,_MI.jpg) | w_lemay | CC BY-SA 2.0 | no | photo |
| 04 | [Serene Park Path with Autumn Leaves and Benches.jpg](https://commons.wikimedia.org/wiki/File:Serene_Park_Path_with_Autumn_Leaves_and_Benches.jpg) | Toxer427 | CC0 | yes | photo, osm-tags |
| 05 | [Picnic table at the park.jpg](https://commons.wikimedia.org/wiki/File:Picnic_table_at_the_park.jpg) | Corn cheese | CC BY 4.0 | no | photo, osm-tags |
| 06 | [University of Michigan Fuller Park playground in March 2025.jpg](https://commons.wikimedia.org/wiki/File:University_of_Michigan_Fuller_Park_playground_in_March_2025.jpg) | Crocodiletiger~commonswiki | CC BY-SA 4.0 | no | photo |
| 07 | [Outdoor basketball court, Hurst Park, Molesey, Surrey 01.jpg](https://commons.wikimedia.org/wiki/File:Outdoor_basketball_court,_Hurst_Park,_Molesey,_Surrey_01.jpg) | Mertbiol | CC0 | no | photo, osm-tags |
| 08 | [Austin Texas food truck 3.jpg](https://commons.wikimedia.org/wiki/File:Austin_Texas_food_truck_3.jpg) | Kurtkaiser | CC0 | no | photo |
| 09 | [Farmers Market Spring 2019.jpg](https://commons.wikimedia.org/wiki/File:Farmers_Market_Spring_2019.jpg) | absolutecharm.com | CC BY-SA 4.0 | yes | photo |
| 10 | [Drinking fountain, Crown Street Park 2018.jpg](https://commons.wikimedia.org/wiki/File:Drinking_fountain,_Crown_Street_Park_2018.jpg) | Rodhullandemu | CC BY-SA 4.0 | no | photo, osm-tags |
| 12 | [Kiwanis Trail Adrian Michigan.JPG](https://commons.wikimedia.org/wiki/File:Kiwanis_Trail_Adrian_Michigan.JPG) | Threeowls | CC BY-SA 4.0 | no | photo |
| 13 | [Pier by Sabine Hut 16-9, Nelson Lakes National Park, New Zealand.jpg](https://commons.wikimedia.org/wiki/File:Pier_by_Sabine_Hut_16-9,_Nelson_Lakes_National_Park,_New_Zealand.jpg) | Michal Klajban | CC BY-SA 4.0 | no | photo |
| 14 | [DSC 8598 A charming wooden terrace cafe ...](https://commons.wikimedia.org/wiki/File:DSC_8598_A_charming_wooden_terrace_cafe_lined_with_colorful_potted_flowers_vintage_lanterns_and_cozy_tables_under_a_clear_blue_sky.jpg) | PattayaPatrol | CC BY-SA 4.0 | no | photo |
| 15 | [Fountain and light show at the Canton tower.jpg](https://commons.wikimedia.org/wiki/File:Fountain_and_light_show_at_the_Canton_tower.jpg) | Nethuzara | CC BY-SA 4.0 | yes | photo |
| 16 | [Sentral Bark Dog Park - Lindsborg KS.jpg](https://commons.wikimedia.org/wiki/File:Sentral_Bark_Dog_Park_-_Lindsborg_KS.jpg) | RuralResurrection | CC BY 4.0 | no | photo |
| 18 | [Bus shelter at VDNKh in Moscow.jpg](https://commons.wikimedia.org/wiki/File:Bus_shelter_at_VDNKh_in_Moscow.jpg) | Dmitry Ivanov | CC BY-SA 4.0 | no | photo, osm-tags |
| 20 | [Friends & Family Picnic YCC 2012 (7748643502).jpg](https://commons.wikimedia.org/wiki/File:Friends_%26_Family_Picnic_YCC_2012_(7748643502).jpg) | Virginia State Parks staff | CC BY 2.0 | yes | photo |
| 21 | [Target shopping cart at Ford City Mall parking lot - Chicago, IL - May 2025.jpg](https://commons.wikimedia.org/wiki/File:Target_shopping_cart_at_Ford_City_Mall_parking_lot_-_Chicago,_IL_-_May_2025.jpg) | AlphaBeta135 | CC BY 4.0 | no | photo |
| 22 | [Students on paths near lawn at Cornell University.jpg](https://commons.wikimedia.org/wiki/File:Students_on_paths_near_lawn_at_Cornell_University.jpg) | Tomwsulcer | CC0 | yes | photo |
| 23 | [Saigon seen from bus 53 in evening rain 16.jpg](https://commons.wikimedia.org/wiki/File:Saigon_seen_from_bus_53_in_evening_rain_16.jpg) | Syced | CC0 | no | photo |
| 24 | [Park Čtyři Dvory, skate park 01.jpg](https://commons.wikimedia.org/wiki/File:Park_%C4%8Cty%C5%99i_Dvory,_skate_park_01.jpg) | Czeva | CC BY-SA 4.0 | no | photo |

License texts: [CC0](https://creativecommons.org/publicdomain/zero/1.0/), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0), [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0).
