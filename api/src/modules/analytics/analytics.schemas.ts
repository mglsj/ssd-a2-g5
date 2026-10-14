import { z } from "@hono/zod-openapi";
import { IsoDate, Money, PageQuery, paged, Timestamp, Uuid } from "../../shared/schemas.ts";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_RANGE_DAYS = 366;
export const DEFAULT_SERIES = 5;
export const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export const Series = z
  .object({
    property_id: Uuid,
    title: z.string(),
    points: z.array(z.object({ day: IsoDate, daily_revenue: Money, moving_avg_7d: Money })),
  })
  .openapi("MovingAverageSeries");

export const MovingAverageQuery = z
  .object({
    property_id: z
      .union([Uuid, z.array(Uuid)])
      .transform((value) => [...new Set(Array.isArray(value) ? value : [value])])
      .pipe(z.array(Uuid).min(1).max(5, "At most 5 property_id values are allowed"))
      .optional()
      .openapi({
        description: "Repeat up to 5 times to compare properties. Default: the top 5 of the ranking on `to`",
        type: "array",
        items: { type: "string", format: "uuid" },
      }),
    from: IsoDate.optional().openapi({ description: "Default: 89 days before `to`" }),
    to: IsoDate.optional().openapi({ description: "Default: the latest day (UTC) with a completed booking" }),
  })
  .refine(({ from, to }) => !from || !to || from <= to, { message: "from must not be after to", path: ["from"] });

export const RankRow = z
  .object({ revenue_rank: z.number().int(), property_id: Uuid, title: z.string(), moving_avg_7d: Money })
  .openapi("RevenueRank");

export const RankQuery = z.object({
  as_of: IsoDate.optional().openapi({ description: "Default: the latest day (UTC) with a completed booking" }),
  limit: z.coerce.number().int().min(1).max(100).default(10).openapi({ description: "Highest rank to include" }),
});

export const Ranking = z.object({ as_of: IsoDate, items: z.array(RankRow) });

export const MovingAverage = z
  .object({ from: IsoDate, to: IsoDate, series: z.array(Series) })
  .openapi("MovingAverage");

export const SummaryRow = z
  .object({
    property_id: Uuid,
    title: z.string(),
    completed_bookings: z.number().int(),
    total_nights_booked: z.number().int(),
    gross_revenue: Money,
  })
  .openapi("PropertySummary");

export const SummaryPage = paged(SummaryRow)
  .extend({
    refreshed_at: Timestamp.nullable(),
    totals: z.object({
      properties: z.number().int(),
      completed_bookings: z.number().int(),
      total_nights_booked: z.number().int(),
      gross_revenue: Money,
    }),
  })
  .openapi("SummaryPage");

export const SummaryQuery = PageQuery.extend({
  sort: z.enum(["gross_revenue", "completed_bookings", "total_nights_booked", "title"]).default("gross_revenue"),
});

export const Refreshed = z.object({ refreshed_at: Timestamp });

export type Series = z.infer<typeof Series>;
export type MovingAverageQuery = z.infer<typeof MovingAverageQuery>;
export type Ranking = z.infer<typeof Ranking>;
export type MovingAverage = z.infer<typeof MovingAverage>;
export type RankQuery = z.infer<typeof RankQuery>;
export type SummaryPage = z.infer<typeof SummaryPage>;
export type SummaryQuery = z.infer<typeof SummaryQuery>;
