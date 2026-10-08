import { Hono } from "hono";
import { query } from "../db/postgres.js";
import { isUUID, pagination } from "../utils/validation.js";
import { badRequest, errorResponse } from "../utils/errors.js";

const app = new Hono();

app.get("/", async (c) => {
  try {
    const pageInfo = pagination(c.req.query());

    if (!pageInfo) {
      return badRequest(c, "Invalid pagination");
    }

    const guestId = c.req.query("guest_id");
    const propertyId = c.req.query("property_id");
    const status = c.req.query("status");

    if (guestId && !isUUID(guestId)) {
      return badRequest(c, "Malformed guest UUID");
    }

    if (propertyId && !isUUID(propertyId)) {
      return badRequest(c, "Malformed property UUID");
    }

    if (
      status &&
      !["CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(status)
    ) {
      return badRequest(c, "Invalid status");
    }

    const conditions = [];
    const params = [];

    if (guestId) {
      params.push(guestId);
      conditions.push(`b.guest_id = $${params.length}`);
    }

    if (propertyId) {
      params.push(propertyId);
      conditions.push(`b.property_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`b.status = $${params.length}`);
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const count = await query(
      `
      SELECT COUNT(*)
      FROM bookings b
      ${where}
      `,
      params
    );

    const result = await query(
      `
      SELECT
        b.id,
        b.guest_id,
        g.name AS guest_name,
        b.property_id,
        p.title AS property_title,
        b.nights,
        b.total_cost,
        b.status,
        b.created_at
      FROM bookings b
      JOIN guests g ON g.id = b.guest_id
      JOIN properties p ON p.id = b.property_id
      ${where}
      ORDER BY b.created_at DESC
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

app.post("/", async (c) => {
  try {
    const body = await c.req.json();

    if (!isUUID(body.guest_id)) {
      return badRequest(c, "Malformed guest UUID");
    }

    if (!isUUID(body.property_id)) {
      return badRequest(c, "Malformed property UUID");
    }

    if (
      !Number.isInteger(body.nights) ||
      body.nights < 1 ||
      body.nights > 365
    ) {
      return badRequest(c, "Nights must be between 1 and 365");
    }

    const result = await query(
      `
      CALL sp_execute_booking(
        $1,
        $2,
        $3,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
      )
      `,
      [
        body.guest_id,
        body.property_id,
        body.nights
      ]
    );

    const row = result.rows[0];

    const bookingResult = await query(
      `
      SELECT
        id,
        guest_id,
        property_id,
        nights,
        total_cost,
        status,
        created_at
      FROM bookings
      WHERE id = $1
      `,
      [row.booking_id]
    );

    const auditResult = await query(
      `
      SELECT
        id,
        action_type,
        amount_changed,
        balance_after,
        timestamp
      FROM wallet_audit_logs
      WHERE id = $1
      `,
      [row.audit_log_id]
    );

    return c.json(
      {
        booking: bookingResult.rows[0],
        balance_before: row.balance_before,
        balance_after: row.balance_after,
        audit_log: auditResult.rows[0]
      },
      201
    );
  } catch (error) {
    const e = errorResponse(error);

    if (
      error?.code === "23514" &&
      error?.constraint === "chk_guests_wallet_nonnegative"
    ) {
      const detail = {};

      const match = error.message.match(
        /costs ([0-9.]+) but the wallet has ([0-9.]+)/
      );

      if (match) {
        detail.total_cost = match[1];
        detail.balance = match[2];
      }

      e.body.error.detail = detail;
    }

    return c.json(e.body, e.status);
  }
});

app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    if (!isUUID(id)) {
      return badRequest(c, "Malformed booking UUID");
    }

    const result = await query(
      `
      SELECT
        b.id,
        b.guest_id,
        g.name AS guest_name,
        b.property_id,
        p.title AS property_title,
        b.nights,
        b.total_cost,
        b.status,
        b.created_at
      FROM bookings b
      JOIN guests g ON g.id = b.guest_id
      JOIN properties p ON p.id = b.property_id
      WHERE b.id = $1
      `,
      [id]
    );

    if (!result.rows.length) {
      return c.json({
        error: {
          code: "NOT_FOUND",
          message: `Booking ${id} does not exist`,
          detail: {}
        }
      }, 404);
    }

    return c.json(result.rows[0]);
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

app.patch("/:id/status", async (c) => {
  try {
    const id = c.req.param("id");

    if (!isUUID(id)) {
      return badRequest(c, "Malformed booking UUID");
    }

    const body = await c.req.json();

    if (
      !["CHECKED_IN", "COMPLETED"].includes(body.status)
    ) {
      return badRequest(c, "Invalid status");
    }

    const result = await query(
      `
      CALL sp_update_booking_status(
        $1,
        $2,
        NULL
      )
      `,
      [id, body.status]
    );

    const previousStatus = result.rows[0].previous_status;

    const booking = await query(
      `
      SELECT id, status
      FROM bookings
      WHERE id = $1
      `,
      [id]
    );

    return c.json({
      booking: booking.rows[0],
      previous_status: previousStatus
    });
  } catch (error) {
    const e = errorResponse(error);

    if (error?.code === "22023") {
      e.body.error.code = "INVALID_TRANSITION";

      const match = error.message.match(
        /A (\w+) booking cannot move to (\w+)/
      );

      if (match) {
        e.body.error.detail = {
          from: match[1],
          to: match[2]
        };
      }
    }

    if (error?.code === "23505") {
      e.body.error.code = "ALREADY_CHECKED_IN";

      const match = error.message.match(
        /booking ([0-9a-f-]+)/i
      );

      e.body.error.detail = {
        active_booking_id: match ? match[1] : null
      };
    }

    return c.json(e.body, e.status);
  }
});

export default app;