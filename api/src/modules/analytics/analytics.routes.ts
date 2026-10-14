import { createRoute } from "@hono/zod-openapi";
import { errors, json } from "../../shared/openapi.ts";
import { MovingAverage, MovingAverageQuery, Ranking, RankQuery, Refreshed, SummaryPage, SummaryQuery } from "./analytics.schemas.ts";

export const movingAverage = createRoute({
  method: "get",
  path: "/moving-average",
  tags: ["Analytics"],
  summary: "7-day moving average of completed booking revenue (Workflow 2)",
  description:
    "Calls `fn_property_moving_avg(from, to, property_id)` once per property. Days are UTC and the range covers at most 366 days. " +
    "With no parameters it charts the top 5 properties over the 90 days up to the latest completed booking, so a first load is never empty. " +
    "The response echoes the `from` and `to` it used.",
  request: { query: MovingAverageQuery },
  responses: { 200: json(MovingAverage, "One series per property"), ...errors(400, 404) },
});

export const rank = createRoute({
  method: "get",
  path: "/rank",
  tags: ["Analytics"],
  summary: "Properties ranked by 7-day moving average with DENSE_RANK() (Workflow 2)",
  description:
    "Ties share a rank, so more rows than `limit` can come back, up to 100. " +
    "Without `as_of` the ranking uses the latest day with a completed booking, so it is not empty when the seed data is a few days old.",
  request: { query: RankQuery },
  responses: { 200: json(Ranking, "Ranked properties"), ...errors(400) },
});

export const summary = createRoute({
  method: "get",
  path: "/summary",
  tags: ["Analytics"],
  summary: "Read mv_property_summary and when it was last refreshed",
  request: { query: SummaryQuery },
  responses: { 200: json(SummaryPage, "Totals and a page of properties"), ...errors(400) },
});

export const refresh = createRoute({
  method: "post",
  path: "/summary/refresh",
  tags: ["Analytics"],
  summary: "REFRESH MATERIALIZED VIEW CONCURRENTLY via refresh_mv_property_summary()",
  responses: { 200: json(Refreshed, "The refresh time") },
});
