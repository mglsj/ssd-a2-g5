import { sql } from "../../db/postgres.ts";
import { offset } from "../../shared/schemas.ts";
import type { RankQuery, Ranking, Series, SummaryPage, SummaryQuery } from "./analytics.schemas.ts";

/** Workflow 2. Returns null when the property does not exist. */
export async function findMovingAverage(propertyId: string, from: string, to: string): Promise<Series | null> {
  const points = await sql`
    SELECT title, day::text AS day, daily_revenue::numeric(14,2)::text AS daily_revenue, moving_avg_7d::text
    FROM fn_property_moving_avg(${from}::date, ${to}::date, ${propertyId}::uuid)
  `;
  if (!points.length) return null;
  return {
    property_id: propertyId,
    title: points[0].title,
    points: points.map(({ title, ...point }: { title: string }) => point),
  };
}

/** The latest UTC day with a COMPLETED booking. The seed data stops a while before today. */
export const latestRevenueDay = async (): Promise<string> =>
  (
    await sql`
      SELECT coalesce(max(created_at AT TIME ZONE 'UTC')::date, current_date)::text AS day
      FROM bookings WHERE status = 'COMPLETED'
    `
  )[0].day;

export async function topPropertyIds(asOf: string, count: number): Promise<string[]> {
  const rows = await sql`
    SELECT property_id FROM fn_property_revenue_rank(${asOf}::date, ${count}::int) LIMIT ${count}
  `;
  return rows.map((row: { property_id: string }) => row.property_id);
}

/** Workflow 2. Ties share a rank, so the row count is capped separately at 100. */
export async function findRanking(query: RankQuery): Promise<Ranking> {
  const asOf = query.as_of ?? (await latestRevenueDay());
  const items = await sql`
    SELECT revenue_rank::int AS revenue_rank, property_id, title, moving_avg_7d::text
    FROM fn_property_revenue_rank(${asOf}::date, ${query.limit}::int)
    LIMIT 100
  `;
  return { as_of: asOf, items };
}

export async function findSummary(query: SummaryQuery): Promise<SummaryPage> {
  const order = {
    gross_revenue: sql`gross_revenue DESC, property_id`,
    completed_bookings: sql`completed_bookings DESC, property_id`,
    total_nights_booked: sql`total_nights_booked DESC, property_id`,
    title: sql`title, property_id`,
  }[query.sort];
  const [[totals], [log], items] = await Promise.all([
    sql`
      SELECT count(*)::int AS properties,
        coalesce(sum(completed_bookings), 0)::int AS completed_bookings,
        coalesce(sum(total_nights_booked), 0)::int AS total_nights_booked,
        coalesce(sum(gross_revenue), 0)::numeric(16,2)::text AS gross_revenue
      FROM mv_property_summary
    `,
    sql`SELECT refreshed_at FROM mv_refresh_log WHERE view_name = 'mv_property_summary'`,
    sql`
      SELECT property_id, title, completed_bookings::int AS completed_bookings,
        total_nights_booked::int AS total_nights_booked, gross_revenue::numeric(14,2)::text AS gross_revenue
      FROM mv_property_summary
      ORDER BY ${order}
      LIMIT ${query.limit} OFFSET ${offset(query)}
    `,
  ]);
  return {
    refreshed_at: log?.refreshed_at ?? null,
    totals,
    items,
    page: query.page,
    limit: query.limit,
    total: totals.properties,
  };
}

export async function refreshSummary(): Promise<{ refreshed_at: string }> {
  const [result] = await sql`SELECT refresh_mv_property_summary() AS refreshed_at`;
  return result;
}
