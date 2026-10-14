import { Hono } from "hono";
import { propertyReviews } from "../db/mongo.js";
import { isUUID, pagination } from "../utils/validation.js";
import { badRequest, errorResponse } from "../utils/errors.js";

const app = new Hono();

function buildReviewAnalyticsPipeline(filter = {}) {
  const pipeline = [];

  if (Object.keys(filter).length > 0) {
    pipeline.push({
      $match: filter
    });
  }

  pipeline.push({
    $facet: {
      rating_distributions: [
        {
          $group: {
            _id: {
              $floor: "$rating"
            },
            count: {
              $sum: 1
            }
          }
        },
        {
          $project: {
            _id: 0,
            rating: "$_id",
            count: 1
          }
        }
      ],

      most_frequent_tags: [
        {
          $unwind: "$location_tags"
        },
        {
          $group: {
            _id: "$location_tags",
            frequency: {
              $sum: 1
            },
            avg_rating: {
              $avg: "$rating"
            }
          }
        },
        {
          $sort: {
            frequency: -1,
            _id: 1
          }
        },
        {
          $limit: 10
        },
        {
          $project: {
            _id: 0,
            tag: "$_id",
            frequency: 1,
            avg_rating: {
              $round: [
                "$avg_rating",
                2
              ]
            }
          }
        }
      ],

      overall_rating_summary: [
        {
          $group: {
            _id: null,
            total_reviews: {
              $sum: 1
            },
            overall_avg_rating: {
              $avg: "$rating"
            },
            min_rating: {
              $min: "$rating"
            },
            max_rating: {
              $max: "$rating"
            },
            avg_cleanliness: {
              $avg: "$sub_ratings.cleanliness"
            },
            avg_location: {
              $avg: "$sub_ratings.location"
            },
            avg_communication: {
              $avg: "$sub_ratings.communication"
            }
          }
        },
        {
          $project: {
            _id: 0,
            total_reviews: 1,
            overall_avg_rating: {
              $round: [
                "$overall_avg_rating",
                2
              ]
            },
            min_rating: 1,
            max_rating: 1,
            sub_category_averages: {
              cleanliness: {
                $round: [
                  "$avg_cleanliness",
                  2
                ]
              },
              location: {
                $round: [
                  "$avg_location",
                  2
                ]
              },
              communication: {
                $round: [
                  "$avg_communication",
                  2
                ]
              }
            }
          }
        }
      ]
    }
  });

  pipeline.push({
    $project: {
      overall_summary: {
        $ifNull: [
          {
            $first:
              "$overall_rating_summary"
          },
          {
            total_reviews: 0,
            overall_avg_rating: null,
            min_rating: null,
            max_rating: null,
            sub_category_averages: {
              cleanliness: null,
              location: null,
              communication: null
            }
          }
        ]
      },

      most_frequent_tags: 1,

      rating_distributions: {
        $let: {
          vars: {
            total: {
              $ifNull: [
                {
                  $first:
                    "$overall_rating_summary.total_reviews"
                },
                0
              ]
            }
          },

          in: {
            $map: {
              input: [5, 4, 3, 2, 1],
              as: "star",

              in: {
                $let: {
                  vars: {
                    count: {
                      $let: {
                        vars: {
                          i: {
                            $indexOfArray: [
                              "$rating_distributions.rating",
                              "$$star"
                            ]
                          }
                        },

                        in: {
                          $cond: [
                            {
                              $gte: [
                                "$$i",
                                0
                              ]
                            },
                            {
                              $arrayElemAt: [
                                "$rating_distributions.count",
                                "$$i"
                              ]
                            },
                            0
                          ]
                        }
                      }
                    }
                  },

                  in: {
                    rating: "$$star",
                    count: "$$count",

                    percentage: {
                      $cond: [
                        {
                          $gt: [
                            "$$total",
                            0
                          ]
                        },
                        {
                          $round: [
                            {
                              $multiply: [
                                {
                                  $divide: [
                                    "$$count",
                                    "$$total"
                                  ]
                                },
                                100
                              ]
                            },
                            1
                          ]
                        },
                        0
                      ]
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  return pipeline;
}

app.get("/analytics", async (c) => {
  try {
    const propertyId =
      c.req.query("property_id");

    const filter = {};

    if (propertyId) {
      if (!isUUID(propertyId)) {
        return badRequest(
          c,
          "Malformed property UUID"
        );
      }

      filter.property_id = propertyId;
    }

    const result =
      await propertyReviews
        .aggregate(
          buildReviewAnalyticsPipeline(
            filter
          )
        )
        .toArray();

    return c.json(
      result[0] || {
        overall_summary: {
          total_reviews: 0,
          overall_avg_rating: null,
          min_rating: null,
          max_rating: null,
          sub_category_averages: {
            cleanliness: null,
            location: null,
            communication: null
          }
        },
        rating_distributions: [],
        most_frequent_tags: []
      }
    );
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

app.get("/", async (c) => {
  try {
    const pageInfo = pagination(
      c.req.query()
    );

    if (!pageInfo) {
      return badRequest(
        c,
        "Invalid pagination"
      );
    }

    const propertyId =
      c.req.query("property_id");

    const rating =
      c.req.query("rating");

    const filter = {};

    if (propertyId) {
      if (!isUUID(propertyId)) {
        return badRequest(
          c,
          "Malformed property UUID"
        );
      }

      filter.property_id = propertyId;
    }

    if (rating !== undefined) {
      const r = Number(rating);

      if (
        !Number.isInteger(r) ||
        r < 1 ||
        r > 5
      ) {
        return badRequest(
          c,
          "Rating must be between 1 and 5"
        );
      }

      filter.rating = r;
    }

    const total =
      await propertyReviews.countDocuments(
        filter
      );

    const items =
      await propertyReviews
        .find(filter)
        .sort({
          created_at: -1
        })
        .skip(pageInfo.offset)
        .limit(pageInfo.limit)
        .toArray();

    const cleaned = items.map(
      ({ _id, ...item }) => item
    );

    return c.json({
      items: cleaned,
      page: pageInfo.page,
      limit: pageInfo.limit,
      total
    });
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

export default app;
