import { createRoute } from "@hono/zod-openapi";
import { errors, json } from "../../shared/openapi.ts";
import { paged } from "../../shared/schemas.ts";
import { Review, ReviewAnalytics, ReviewAnalyticsQuery, ReviewListQuery } from "./reviews.schemas.ts";

export const analytics = createRoute({
  method: "get",
  path: "/analytics",
  tags: ["Reviews"],
  summary: "Rating distribution, top tags and average rating (Workflow 4, $facet)",
  description:
    "Runs `buildReviewAnalyticsPipeline` from `mongo/03_workflow4_facet.js`. `rating_distributions` always has all five stars.",
  request: { query: ReviewAnalyticsQuery },
  responses: { 200: json(ReviewAnalytics, "The three facets"), ...errors(400) },
});

export const list = createRoute({
  method: "get",
  path: "/",
  tags: ["Reviews"],
  summary: "List reviews, newest first",
  request: { query: ReviewListQuery },
  responses: { 200: json(paged(Review), "A page of reviews"), ...errors(400) },
});
