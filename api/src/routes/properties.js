import { Hono } from "hono";
import { query } from "../db/postgres.js";
import { propertyAmenities } from "../db/mongo.js";
import { escapeLike, isUUID, pagination } from "../utils/validation.js";
import { badRequest, errorResponse } from "../utils/errors.js";

const app = new Hono();

app.get("/", async (c) => {
  try {
    const q = c.req.query("q") || "";
    const sort = c.req.query("sort") || "title";
    const minPrice = c.req.query("min_price");
    const maxPrice = c.req.query("max_price");

    const pageInfo = pagination(c.req.query());

    if (!pageInfo) {
      return badRequest(c, "Invalid pagination");
    }

    const sortMap = {
      title: "p.title ASC, p.id ASC",
      price_asc: "p.base_price ASC, p.id ASC",
      price_desc: "p.base_price DESC, p.id ASC",
      revenue: "COALESCE(m.gross_revenue, 0) DESC, p.id ASC"
    };

    if (!sortMap[sort]) {
      return badRequest(c, "Invalid sort");
    }

    const conditions = [
      "p.title ILIKE '%' || $1 || '%' ESCAPE '\\'"
    ];

    const params = [escapeLike(q)];

    let minValue = null;

    if (minPrice !== undefined) {
      const n = Number(minPrice);

      if (minPrice.trim() === "" || !Number.isFinite(n) || n < 0) {
        return badRequest(c, "Invalid min_price");
      }

      minValue = n;

      params.push(n);
      conditions.push(`p.base_price >= $${params.length}`);
    }

    let maxValue = null;

    if (maxPrice !== undefined) {
      const n = Number(maxPrice);

      if (maxPrice.trim() === "" || !Number.isFinite(n) || n < 0) {
        return badRequest(c, "Invalid max_price");
      }

      maxValue = n;

      params.push(n);
      conditions.push(`p.base_price <= $${params.length}`);
    }

    if (minValue !== null && maxValue !== null && minValue > maxValue) {
      return badRequest(c, "min_price cannot be greater than max_price");
    }

    const where = conditions.join(" AND ");

    const count = await query(
      `
      SELECT COUNT(*)
      FROM properties p
      WHERE ${where}
      `,
      params
    );

    const result = await query(
      `
      SELECT
        p.id,
        p.title,
        p.base_price,
        p.latitude,
        p.longitude
      FROM properties p
      LEFT JOIN mv_property_summary m
        ON m.property_id = p.id
      WHERE ${where}
      ORDER BY ${sortMap[sort]}
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
      `,
      [...params, pageInfo.limit, pageInfo.offset]
    );

    return c.json({
      items: result.rows,
      page: pageInfo.page,
      limit: pageInfo.limit,
      total: Number(count.rows[0].count)
    });
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

app.get("/:id/amenities", async (c) => {
  try {
    const id = c.req.param("id");

    if (!isUUID(id)) {
      return badRequest(c, "Malformed property UUID");
    }

    const document = await propertyAmenities.findOne({
      property_id: id
    });

    if (!document) {
      return c.json({
        error: {
          code: "NOT_FOUND",
          message: "Property amenities not found",
          detail: {}
        }
      }, 404);
    }

    const { _id, property_id, ...result } = document;

    return c.json(result);
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    if (!isUUID(id)) {
      return badRequest(c, "Malformed property UUID");
    }

    const result = await query(
      `
      SELECT
        p.id,
        p.title,
        p.base_price,
        p.latitude,
        p.longitude,
        m.completed_bookings,
        m.total_nights_booked,
        m.gross_revenue
      FROM properties p
      LEFT JOIN mv_property_summary m
        ON m.property_id = p.id
      WHERE p.id = $1
      `,
      [id]
    );

    if (!result.rows.length) {
      return c.json({
        error: {
          code: "NOT_FOUND",
          message: `Property ${id} does not exist`,
          detail: {}
        }
      }, 404);
    }

    const row = result.rows[0];

    return c.json({
      id: row.id,
      title: row.title,
      base_price: row.base_price,
      latitude: row.latitude,
      longitude: row.longitude,
      summary: {
        completed_bookings: Number(row.completed_bookings || 0),
        total_nights_booked: Number(row.total_nights_booked || 0),
        gross_revenue: row.gross_revenue || "0.00"
      }
    });
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

export default app;