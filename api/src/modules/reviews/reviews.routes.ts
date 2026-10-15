import { createRoute } from "@hono/zod-openapi";
import { errors, json, jsonBody } from "../../shared/openapi.ts";
import { paged } from "../../shared/schemas.ts";
import {
  CreateReviewBody,
  Eligibility,
  EligibilityQuery,
  Review,
  ReviewAnalytics,
  ReviewAnalyticsQuery,
  ReviewListQuery,
} from "./reviews.schemas.ts";

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

export const eligibility = createRoute({
  method: "get",
  path: "/eligibility",
  tags: ["Reviews"],
  summary: "Whether a guest can review a property",
  description: "A guest can review once per COMPLETED stay. `booking_id` is the stay the review would be tied to.",
  request: { query: EligibilityQuery },
  responses: { 200: json(Eligibility, "The answer and why"), ...errors(400) },
});

export const create = createRoute({
  method: "post",
  path: "/",
  tags: ["Reviews"],
  summary: "Leave a review for a completed stay",
  description:
    "Needs a COMPLETED booking for this guest and property that has no review yet, otherwise `NO_COMPLETED_STAY` (403) or `ALREADY_REVIEWED` (409). " +
    "The review is stored in `PropertyReviews` with that `booking_id`.",
  request: { body: jsonBody(CreateReviewBody) },
  responses: { 201: json(Review, "The new review"), ...errors(400, 403, 409, 422) },
});
