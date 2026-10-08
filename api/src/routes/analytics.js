import { Hono } from "hono";
import { query } from "../db/postgres.js";
import { isUUID, pagination, today } from "../utils/validation.js";
import { badRequest, errorResponse } from "../utils/errors.js";

const app = new Hono();

app.get("/moving-average", async (c) => {
  try {
    const propertyIds = c.req.queries("property_id") || [];

    if (!propertyIds.length) {
      return badRequest(c, "property_id is required");
    }

    if (propertyIds.length > 5) {
      return badRequest(c, "At most 5 property_id values are allowed");
    }

    for (const id of propertyIds) {
      if (!isUUID(id)) {
        return badRequest(c, "Malformed property UUID");
      }
    }

    const end = c.req.query("to") || today();

    const defaultFrom = new Date();
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 89);

    const from =
      c.req.query("from") ||
      defaultFrom.toISOString().slice(0, 10);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end)
    ) {
      return badRequest(c, "Invalid date");
    }

    const fromDate = new Date(`${from}T00:00:00Z`);
    const toDate = new Date(`${end}T00:00:00Z`);

    const days =
      Math.floor(
        (toDate - fromDate) / (1000 * 60 * 60 * 24)
      ) + 1;

    if (days < 1 || days > 366) {
      return badRequest(c, "Date range must be between 1 and 366 days");
    }

    const rows = [];

    for (const propertyId of propertyIds) {
      const result = await query(
        `
        SELECT *
        FROM fn_property_moving_avg(
          $1::date,
          $2::date,
          $3::uuid
        )
        `,
        [from, end, propertyId]
      );

      rows.push({
        property_id: propertyId,
        title: result.rows[0]?.title || null,
        points: result.rows.map((r) => ({
          day: r.day,
          daily_revenue: r.daily_revenue,
          moving_avg_7d: r.moving_avg_7d
        }))
      });
    }

    return c.json({
      series: rows
    });
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

app.get("/rank", async (c) => {
  try {
    const asOf = c.req.query("as_of") || today();
    const limit = Number(c.req.query("limit") || 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      return badRequest(c, "Invalid as_of date");
    }

    if (!Number.isInteger(limit) || limit <= 0) {
      return badRequest(c, "Invalid limit");
    }

    const result = await query(
      `
      SELECT *
      FROM fn_property_revenue_rank($1::date, $2)
      `,
      [asOf, limit]
    );

    return c.json({
      items: result.rows
    });
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

app.get("/summary", async (c) => {
  try {
    const pageInfo = pagination(c.req.query());

    if (!pageInfo) {
      return badRequest(c, "Invalid pagination");
    }

    const sort = c.req.query("sort") || "gross_revenue";

    const sortMap = {
      gross_revenue: "gross_revenue DESC",
      completed_bookings: "completed_bookings DESC",
      total_nights_booked: "total_nights_booked DESC",
      title: "title ASC"
    };

    if (!sortMap[sort]) {
      return badRequest(c, "Invalid sort");
    }

    const totalResult = await query(
      `
      SELECT
        COUNT(*) AS properties,
        COALESCE(SUM(completed_bookings), 0) AS completed_bookings,
        COALESCE(SUM(total_nights_booked), 0) AS total_nights_booked,
        COALESCE(SUM(gross_revenue), 0) AS gross_revenue
      FROM mv_property_summary
      `
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM mv_property_summary`
    );

    const refreshResult = await query(
      `
      SELECT refreshed_at
      FROM mv_refresh_log
      WHERE view_name = 'mv_property_summary'
      `
    );

    const result = await query(
      `
      SELECT
        property_id,
        title,
        completed_bookings,
        total_nights_booked,
        gross_revenue
      FROM mv_property_summary
      ORDER BY ${sortMap[sort]}
      LIMIT $1 OFFSET $2
      `,
      [pageInfo.limit, pageInfo.offset]
    );

    const totals = totalResult.rows[0];

    return c.json({
      refreshed_at:
        refreshResult.rows[0]?.refreshed_at || null,
      totals: {
        properties: Number(totals.properties),
        completed_bookings: Number(totals.completed_bookings),
        total_nights_booked: Number(totals.total_nights_booked),
        gross_revenue: totals.gross_revenue
      },
      items: result.rows,
      page: pageInfo.page,
      limit: pageInfo.limit,
      total: Number(countResult.rows[0].count)
    });
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

app.post("/summary/refresh", async (c) => {
  try {
    const result = await query(
      `
      SELECT refresh_mv_property_summary()
      AS refreshed_at
      `
    );

    return c.json({
      refreshed_at: result.rows[0].refreshed_at
    });
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

export default app;