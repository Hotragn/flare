/* Flare pinned query: amenities near Fairlane Town Center, Dearborn, MI.
   Centre: OSM way 168151050 (shop=mall, "Fairlane Town Center"), centroid 42.3169092, -83.2229394.
   Radius: 3000 m. Endpoint: https://overpass-api.de/api/interpreter (send a User-Agent).
   Counts are elements (nodes, ways, relations) matching each tag. */
[out:json][timeout:90];
(
  nwr(around:3000,42.3169092,-83.2229394)["amenity"="bench"];
  nwr(around:3000,42.3169092,-83.2229394)["leisure"="picnic_table"];
  nwr(around:3000,42.3169092,-83.2229394)["amenity"="toilets"];
  nwr(around:3000,42.3169092,-83.2229394)["amenity"="drinking_water"];
  nwr(around:3000,42.3169092,-83.2229394)["leisure"="park"];
  nwr(around:3000,42.3169092,-83.2229394)["highway"="steps"];
);
out tags center;
