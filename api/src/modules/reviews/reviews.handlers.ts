import type { Handler } from "../../shared/openapi.ts";
import * as reviews from "./reviews.repository.ts";
import type * as routes from "./reviews.routes.ts";

export const analytics: Handler<typeof routes.analytics> = async (c) =>
  c.json(await reviews.findReviewAnalytics(c.req.valid("query").property_id), 200);

export const list: Handler<typeof routes.list> = async (c) => c.json(await reviews.listReviews(c.req.valid("query")), 200);
