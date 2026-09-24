function buildHotspotPipeline({
  lng,
  lat,
  radiusMeters = 5000,
  sinceMinutes = 120,
  sortBy = "volume",
  now = new Date(),
}) {
  const since = new Date(now.getTime() - sinceMinutes * 60 * 1000);
  const sort =
    sortBy === "distance"
      ? { avg_distance_meters: 1, search_volume: -1 }
      : { search_volume: -1, avg_distance_meters: 1 };

  return [
    {
      $geoNear: {
        near: { type: "Point", coordinates: [lng, lat] },
        distanceField: "distance_meters",
        maxDistance: radiusMeters,
        spherical: true,
        query: { created_at: { $gte: since } },
      },
    },
    {
      $group: {
        _id: {
          grid_longitude: { $round: [{ $arrayElemAt: ["$location.coordinates", 0] }, 2] },
          grid_latitude: { $round: [{ $arrayElemAt: ["$location.coordinates", 1] }, 2] },
        },
        total_searches: { $sum: 1 },
        unique_searchers: { $addToSet: "$user_id" },
        avg_distance_meters: { $avg: "$distance_meters" },
        min_distance_meters: { $min: "$distance_meters" },
        max_distance_meters: { $max: "$distance_meters" },
        latest_search_timestamp: { $max: "$created_at" },
      },
    },
    {
      $project: {
        _id: 0,
        hotspot_cluster: {
          type: "Point",
          coordinates: ["$_id.grid_longitude", "$_id.grid_latitude"],
        },
        grid_coordinates: {
          longitude: "$_id.grid_longitude",
          latitude: "$_id.grid_latitude",
        },
        search_volume: "$total_searches",
        unique_users_count: { $size: "$unique_searchers" },
        avg_distance_meters: { $round: ["$avg_distance_meters", 1] },
        avg_distance_km: { $round: [{ $divide: ["$avg_distance_meters", 1000] }, 2] },
        min_distance_meters: { $round: ["$min_distance_meters", 1] },
        max_distance_meters: { $round: ["$max_distance_meters", 1] },
        latest_search_at: "$latest_search_timestamp",
        hotspot_status: {
          $switch: {
            branches: [
              { case: { $gte: ["$total_searches", 30] }, then: "CRITICAL_SURGE" },
              { case: { $gte: ["$total_searches", 20] }, then: "HIGH_DEMAND" },
              { case: { $gte: ["$total_searches", 10] }, then: "MODERATE_DEMAND" },
            ],
            default: "LOW_ACTIVITY",
          },
        },
      },
    },
    { $sort: sort },
  ];
}

function buildRadialDensityPipeline({ lng, lat, radiusMeters = 5000, sinceMinutes = 120, now = new Date() }) {
  const since = new Date(now.getTime() - sinceMinutes * 60 * 1000);
  const boundaries = [];
  for (let m = 0; m <= radiusMeters; m += 1000) boundaries.push(m);
  if (boundaries[boundaries.length - 1] < radiusMeters) boundaries.push(radiusMeters);
  boundaries[boundaries.length - 1] = radiusMeters + 1;

  return [
    {
      $geoNear: {
        near: { type: "Point", coordinates: [lng, lat] },
        distanceField: "distance_meters",
        maxDistance: radiusMeters,
        spherical: true,
        query: { created_at: { $gte: since } },
      },
    },
    {
      $bucket: {
        groupBy: "$distance_meters",
        boundaries,
        output: {
          pin_drops_count: { $sum: 1 },
          unique_users: { $addToSet: "$user_id" },
          avg_distance_m: { $avg: "$distance_meters" },
        },
      },
    },
    {
      $project: {
        _id: 0,
        ring_start_km: { $divide: ["$_id", 1000] },
        ring_end_km: { $min: [{ $add: [{ $divide: ["$_id", 1000] }, 1] }, radiusMeters / 1000] },
        pin_drops_count: 1,
        unique_searchers: { $size: "$unique_users" },
        avg_distance_m: { $round: ["$avg_distance_m", 1] },
      },
    },
  ];
}

function runWorkflow3() {
  const targetDb = typeof db !== "undefined" ? db.getSiblingDB("stayspot") : new Mongo().getDB("stayspot");

  const params = {
    lng: parseFloat(process.env.HOTSPOT_LNG || "78.4000"),
    lat: parseFloat(process.env.HOTSPOT_LAT || "17.4400"),
    radiusMeters: 5000,
    sinceMinutes: 120,
  };
  const hotspotPipeline = buildHotspotPipeline(params);

  if (typeof EXPLAIN !== "undefined" && EXPLAIN === true) {
    print(EJSON.stringify(targetDb.SearchSessions.explain("executionStats").aggregate(hotspotPipeline), null, 2));
    return;
  }

  print("================================================================================");
  print("Workflow 3: Trending Search Hotspots Pipeline");
  print("Database: " + targetDb.getName());
  print("================================================================================\n");
  print(`Center      : [Longitude: ${params.lng}, Latitude: ${params.lat}]`);
  print(`Radius      : ${params.radiusMeters} meters`);
  print(`Recent pins : last ${params.sinceMinutes} minutes\n`);

  const hotspots = targetDb.SearchSessions.aggregate(hotspotPipeline).toArray();

  print(`Found ${hotspots.length} hotspot clusters within ${params.radiusMeters / 1000} km:\n`);
  let totalPins = 0;
  hotspots.forEach((h, i) => {
    totalPins += h.search_volume;
    print(`  [Rank #${i + 1}] Status: [${h.hotspot_status}]`);
    print(`    - Cluster Coordinates : [Lon: ${h.grid_coordinates.longitude}, Lat: ${h.grid_coordinates.latitude}]`);
    print(`    - Search Volume       : ${h.search_volume} sessions (${h.unique_users_count} unique searchers)`);
    print(`    - Distance Range      : ${h.min_distance_meters}m to ${h.max_distance_meters}m (Avg: ${h.avg_distance_meters}m)`);
    print(`    - Latest Pin Drop     : ${h.latest_search_at.toISOString()}`);
    print("");
  });
  print(`Total pin drops in radius: ${totalPins}`);

  print("\n--------------------------------------------------------------------------------");
  print("Pin drops per 1 km ring:");
  print("--------------------------------------------------------------------------------");
  targetDb.SearchSessions.aggregate(buildRadialDensityPipeline(params)).forEach((r) => {
    const ring = `${r.ring_start_km} - ${r.ring_end_km} km`.padEnd(12);
    print(`  * ${ring} : ${String(r.pin_drops_count).padStart(6)} searches | Avg distance: ${r.avg_distance_m}m | Searchers: ${r.unique_searchers}`);
  });
}

if (typeof db === "undefined") {
  module.exports = { buildHotspotPipeline, buildRadialDensityPipeline };
} else {
  runWorkflow3();
}
