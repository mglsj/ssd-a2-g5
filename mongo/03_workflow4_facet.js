function buildReviewAnalyticsPipeline(filter = {}) {
  const pipeline = [];
  if (filter && Object.keys(filter).length > 0) {
    pipeline.push({ $match: filter });
  }

  pipeline.push({
    $facet: {
      rating_distributions: [
        { $group: { _id: { $floor: "$rating" }, count: { $sum: 1 } } },
        { $project: { _id: 0, rating: "$_id", count: 1 } },
      ],
      most_frequent_tags: [
        { $unwind: "$location_tags" },
        {
          $group: {
            _id: "$location_tags",
            frequency: { $sum: 1 },
            avg_rating: { $avg: "$rating" },
          },
        },
        { $sort: { frequency: -1, _id: 1 } },
        { $limit: 10 },
        { $project: { _id: 0, tag: "$_id", frequency: 1, avg_rating: { $round: ["$avg_rating", 2] } } },
      ],
      overall_rating_summary: [
        {
          $group: {
            _id: null,
            total_reviews: { $sum: 1 },
            overall_avg_rating: { $avg: "$rating" },
            min_rating: { $min: "$rating" },
            max_rating: { $max: "$rating" },
            avg_cleanliness: { $avg: "$sub_ratings.cleanliness" },
            avg_location: { $avg: "$sub_ratings.location" },
            avg_communication: { $avg: "$sub_ratings.communication" },
          },
        },
        {
          $project: {
            _id: 0,
            total_reviews: 1,
            overall_avg_rating: { $round: ["$overall_avg_rating", 2] },
            min_rating: 1,
            max_rating: 1,
            sub_category_averages: {
              cleanliness: { $round: ["$avg_cleanliness", 2] },
              location: { $round: ["$avg_location", 2] },
              communication: { $round: ["$avg_communication", 2] },
            },
          },
        },
      ],
    },
  });

  pipeline.push({
    $project: {
      overall_summary: {
        $ifNull: [
          { $first: "$overall_rating_summary" },
          {
            total_reviews: 0,
            overall_avg_rating: null,
            min_rating: null,
            max_rating: null,
            sub_category_averages: { cleanliness: null, location: null, communication: null },
          },
        ],
      },
      most_frequent_tags: 1,
      rating_distributions: {
        $let: {
          vars: { total: { $ifNull: [{ $first: "$overall_rating_summary.total_reviews" }, 0] } },
          in: {
            $map: {
              input: [5, 4, 3, 2, 1],
              as: "star",
              in: {
                $let: {
                  vars: {
                    count: {
                      $ifNull: [
                        {
                          $first: {
                            $map: {
                              input: {
                                $filter: {
                                  input: "$rating_distributions",
                                  as: "d",
                                  cond: { $eq: ["$$d.rating", "$$star"] },
                                },
                              },
                              as: "d",
                              in: "$$d.count",
                            },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: {
                    rating: "$$star",
                    count: "$$count",
                    percentage: {
                      $cond: [
                        { $gt: ["$$total", 0] },
                        { $round: [{ $multiply: [{ $divide: ["$$count", "$$total"] }, 100] }, 1] },
                        0,
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return pipeline;
}

function runWorkflow4() {
  const targetDb = typeof db !== "undefined" ? db.getSiblingDB("stayspot") : new Mongo().getDB("stayspot");

  const globalPipeline = buildReviewAnalyticsPipeline();
  const sample = targetDb.PropertyReviews.findOne({}, { property_id: 1 });
  const singlePropertyPipeline = sample ? buildReviewAnalyticsPipeline({ property_id: sample.property_id }) : null;

  if (typeof EXPLAIN !== "undefined" && EXPLAIN === true) {
    const explain = targetDb.PropertyReviews.explain("executionStats").aggregate(singlePropertyPipeline || globalPipeline);
    print(EJSON.stringify(explain, null, 2));
    return;
  }

  print("================================================================================");
  print("Workflow 4: Multi-Faceted Review Analytics Pipeline ($facet)");
  print("Database: " + targetDb.getName());
  print("================================================================================\n");

  function displayAnalyticsResults(title, results) {
    print("================================================================================");
    print(title);
    print("================================================================================");

    if (!results || results.length === 0 || results[0].overall_summary.total_reviews === 0) {
      print("  [No reviews found]\n");
      return;
    }

    const { overall_summary: summary, rating_distributions: distributions, most_frequent_tags: tags } = results[0];

    print("\n1. OVERALL RATING SUMMARY:");
    print("--------------------------------------------------------------------------------");
    print(`  - Total reviews  : ${summary.total_reviews}`);
    print(`  - Average rating : ${summary.overall_avg_rating} / 5`);
    print(`  - Rating range   : ${summary.min_rating} to ${summary.max_rating}`);
    const sub = summary.sub_category_averages;
    print(`  - Sub-ratings    : Cleanliness ${sub.cleanliness} | Location ${sub.location} | Communication ${sub.communication}`);

    print("\n2. RATING DISTRIBUTION (1 TO 5 STARS):");
    print("--------------------------------------------------------------------------------");
    distributions.forEach((d) => {
      const bar = "█".repeat(Math.round(d.percentage / 2.5));
      print(`  ${d.rating} stars : ${String(d.count).padStart(5)}  (${d.percentage.toFixed(1).padStart(5)}%)  ${bar}`);
    });

    print("\n3. TOP 10 REVIEW TAGS ($unwind):");
    print("--------------------------------------------------------------------------------");
    tags.forEach((t, i) => {
      print(`  #${String(i + 1).padStart(2)}  ${t.tag.padEnd(25)} : ${String(t.frequency).padStart(6)} reviews  |  avg rating ${t.avg_rating}`);
    });
    print("\n");
  }

  displayAnalyticsResults("ALL REVIEWS", targetDb.PropertyReviews.aggregate(globalPipeline).toArray());

  if (singlePropertyPipeline) {
    displayAnalyticsResults(
      `ONE PROPERTY (property_id: ${sample.property_id})`,
      targetDb.PropertyReviews.aggregate(singlePropertyPipeline).toArray()
    );
  }
}

if (typeof db === "undefined") {
  module.exports = { buildReviewAnalyticsPipeline };
} else {
  runWorkflow4();
}
