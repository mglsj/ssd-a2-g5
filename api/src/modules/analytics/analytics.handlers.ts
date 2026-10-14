import { ApiError, notFound } from "../../shared/errors/api-error.ts";
import type { Handler } from "../../shared/openapi.ts";
import * as analytics from "./analytics.repository.ts";
import type * as routes from "./analytics.routes.ts";
import { DAY_MS, DEFAULT_SERIES, isoDay, MAX_RANGE_DAYS } from "./analytics.schemas.ts";

export const movingAverage: Handler<typeof routes.movingAverage> = async (c) => {
  const query = c.req.valid("query");
  const to = query.to ?? (await analytics.latestRevenueDay());
  const from = query.from ?? isoDay(new Date(Date.parse(to) - 89 * DAY_MS));
  if (from > to || Date.parse(to) - Date.parse(from) >= MAX_RANGE_DAYS * DAY_MS) {
    throw new ApiError(400, "BAD_REQUEST", `from must not be after to, and the range can cover at most ${MAX_RANGE_DAYS} days`);
  }
  const ids = query.property_id ?? (await analytics.topPropertyIds(to, DEFAULT_SERIES));
  const series = await Promise.all(
    ids.map(async (id) => {
      const result = await analytics.findMovingAverage(id, from, to);
      if (!result) throw notFound("Property", id);
      return result;
    }),
  );
  return c.json({ from, to, series }, 200);
};

export const rank: Handler<typeof routes.rank> = async (c) => c.json(await analytics.findRanking(c.req.valid("query")), 200);

export const summary: Handler<typeof routes.summary> = async (c) =>
  c.json(await analytics.findSummary(c.req.valid("query")), 200);

export const refresh: Handler<typeof routes.refresh> = async (c) => c.json(await analytics.refreshSummary(), 200);
