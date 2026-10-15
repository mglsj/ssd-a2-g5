import type { Handler } from "../../shared/openapi.ts";
import * as reviews from "./reviews.repository.ts";
import type * as routes from "./reviews.routes.ts";

export const analytics: Handler<typeof routes.analytics> = async (c) =>
  c.json(await reviews.findReviewAnalytics(c.req.valid("query").property_id), 200);

export const list: Handler<typeof routes.list> = async (c) => c.json(await reviews.listReviews(c.req.valid("query")), 200);

export const eligibility: Handler<typeof routes.eligibility> = async (c) =>
  c.json(await reviews.checkEligibility(c.req.valid("query")), 200);

export const create: Handler<typeof routes.create> = async (c) =>
  c.json(await reviews.createReview(c.req.valid("json")), 201);
