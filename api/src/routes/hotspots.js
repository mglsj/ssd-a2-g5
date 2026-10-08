import { Hono } from "hono";
import { searchSessions } from "../db/mongo.js";
import { badRequest, errorResponse } from "../utils/errors.js";
import { newSessionId } from "../utils/validation.js";

const app = new Hono();

function geoNearStage({
  lng,
  lat,
  radiusMeters,
  sinceMinutes,
  now
}) {
  return {
    $geoNear: {
      near: {
        type: "Point",
        coordinates: [lng, lat]
      },
      distanceField: "distance_meters",
      maxDistance: radiusMeters,
      spherical: true,
      query: {
        created_at: {
          $gte: new Date(
            now.getTime() -
            sinceMinutes * 60 * 1000
          )
        }
      }
    }
  };
}

function buildHotspotPipeline({
  lng,
  lat,
  radiusMeters = 5000,
  sinceMinutes = 120,
  sortBy = "distance",
  now = new Date()
}) {
  const sort =
    sortBy === "distance"
      ? {
          avg_distance_meters: 1,
          search_volume: -1
        }
      : {
          search_volume: -1,
          avg_distance_meters: 1
        };

  return [
    geoNearStage({
      lng,
      lat,
      radiusMeters,
      sinceMinutes,
      now
    }),
    {
      $group: {
        _id: {
          grid_longitude: {
            $round: [
              {
                $arrayElemAt: [
                  "$location.coordinates",
                  0
                ]
              },
              2
            ]
          },
          grid_latitude: {
            $round: [
              {
                $arrayElemAt: [
                  "$location.coordinates",
                  1
                ]
              },
              2
            ]
          }
        },
        total_searches: {
          $sum: 1
        },
        unique_searchers: {
          $addToSet: "$user_id"
        },
        avg_distance_meters: {
          $avg: "$distance_meters"
        },
        min_distance_meters: {
          $min: "$distance_meters"
        },
        max_distance_meters: {
          $max: "$distance_meters"
        },
        latest_search_timestamp: {
          $max: "$created_at"
        }
      }
    },
    {
      $project: {
        _id: 0,
        hotspot_cluster: {
          type: "Point",
          coordinates: [
            "$_id.grid_longitude",
            "$_id.grid_latitude"
          ]
        },
        grid_coordinates: {
          longitude: "$_id.grid_longitude",
          latitude: "$_id.grid_latitude"
        },
        search_volume: "$total_searches",
        unique_users_count: {
          $size: "$unique_searchers"
        },
        avg_distance_meters: {
          $round: [
            "$avg_distance_meters",
            1
          ]
        },
        avg_distance_km: {
          $round: [
            {
              $divide: [
                "$avg_distance_meters",
                1000
              ]
            },
            2
          ]
        },
        min_distance_meters: {
          $round: [
            "$min_distance_meters",
            1
          ]
        },
        max_distance_meters: {
          $round: [
            "$max_distance_meters",
            1
          ]
        },
        latest_search_at:
          "$latest_search_timestamp",
        hotspot_status: {
          $switch: {
            branches: [
              {
                case: {
                  $gte: [
                    "$total_searches",
                    30
                  ]
                },
                then: "CRITICAL_SURGE"
              },
              {
                case: {
                  $gte: [
                    "$total_searches",
                    20
                  ]
                },
                then: "HIGH_DEMAND"
              },
              {
                case: {
                  $gte: [
                    "$total_searches",
                    10
                  ]
                },
                then: "MODERATE_DEMAND"
              }
            ],
            default: "LOW_ACTIVITY"
          }
        }
      }
    },
    {
      $sort: sort
    }
  ];
}

function buildRadialDensityPipeline({
  lng,
  lat,
  radiusMeters = 5000,
  sinceMinutes = 120,
  now = new Date()
}) {
  const boundaries = [];

  for (let m = 0; m <= radiusMeters; m += 1000) {
    boundaries.push(m);
  }

  if (
    boundaries[boundaries.length - 1] <
    radiusMeters
  ) {
    boundaries.push(radiusMeters);
  }

  boundaries[boundaries.length - 1] =
    radiusMeters + 1;

  return [
    geoNearStage({
      lng,
      lat,
      radiusMeters,
      sinceMinutes,
      now
    }),
    {
      $bucket: {
        groupBy: "$distance_meters",
        boundaries,
        output: {
          pin_drops_count: {
            $sum: 1
          },
          unique_users: {
            $addToSet: "$user_id"
          },
          avg_distance_m: {
            $avg: "$distance_meters"
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        ring_start_km: {
          $divide: ["$_id", 1000]
        },
        ring_end_km: {
          $min: [
            {
              $add: [
                {
                  $divide: [
                    "$_id",
                    1000
                  ]
                },
                1
              ]
            },
            radiusMeters / 1000
          ]
        },
        pin_drops_count: 1,
        unique_searchers: {
          $size: "$unique_users"
        },
        avg_distance_m: {
          $round: [
            "$avg_distance_m",
            1
          ]
        }
      }
    }
  ];
}

function getLocationParams(c) {
  const lat = Number(
    c.req.query("lat") || 17.4455
  );

  const lng = Number(
    c.req.query("lng") || 78.3489
  );

  const radius = Number(
    c.req.query("radius") || 5000
  );

  const since = Number(
    c.req.query("since") || 120
  );

  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90
  ) {
    return null;
  }

  if (
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  if (
    !Number.isFinite(radius) ||
    radius <= 0 ||
    radius > 5000
  ) {
    return null;
  }

  if (
    !Number.isFinite(since) ||
    since <= 0
  ) {
    return null;
  }

  return {
    lat,
    lng,
    radius,
    since
  };
}

app.get("/", async (c) => {
  try {
    const params = getLocationParams(c);

    if (!params) {
      return badRequest(c, "Invalid map parameters");
    }

    const sort = c.req.query("sort") || "distance";

    if (!["distance", "volume"].includes(sort)) {
      return badRequest(c, "Invalid sort");
    }

    const items = await searchSessions
      .aggregate(
        buildHotspotPipeline({
          lat: params.lat,
          lng: params.lng,
          radiusMeters: params.radius,
          sinceMinutes: params.since,
          sortBy: sort
        })
      )
      .toArray();

    return c.json({
      center: {
        lat: params.lat,
        lng: params.lng
      },
      radius_meters: params.radius,
      generated_at: new Date().toISOString(),
      items
    });
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

app.get("/density", async (c) => {
  try {
    const params = getLocationParams(c);

    if (!params) {
      return badRequest(c, "Invalid map parameters");
    }

    const items = await searchSessions
      .aggregate(
        buildRadialDensityPipeline({
          lat: params.lat,
          lng: params.lng,
          radiusMeters: params.radius,
          sinceMinutes: params.since
        })
      )
      .toArray();

    return c.json({
      center: {
        lat: params.lat,
        lng: params.lng
      },
      radius_meters: params.radius,
      generated_at: new Date().toISOString(),
      items
    });
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

app.post("/../search-sessions", async (c) => {
  try {
    const body = await c.req.json();

    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90
    ) {
      return badRequest(c, "Invalid latitude");
    }

    if (
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180
    ) {
      return badRequest(c, "Invalid longitude");
    }

    const document = {
      session_id: newSessionId(),
      user_id: body.user_id || "anonymous",
      location: {
        type: "Point",
        coordinates: [lng, lat]
      },
      created_at: new Date()
    };

    const result =
      await searchSessions.insertOne(document);

    return c.json(
      {
        _id: result.insertedId,
        ...document
      },
      201
    );
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

export default app;
