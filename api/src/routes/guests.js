import { Hono } from "hono";
import { query } from "../db/postgres.js";
import {
  isUUID,
  pagination
} from "../utils/validation.js";
import {
  badRequest,
  errorResponse
} from "../utils/errors.js";

const app = new Hono();

function parseMoney(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    return value;
  }

  if (typeof value === "string") {
    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      return null;
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return null;
    }

    return number;
  }

  return null;
}

/*
 * GET /api/guests
 */
app.get("/", async (c) => {
  try {
    const q = c.req.query("q") || "";
    const sort = c.req.query("sort") || "name";

    const pageInfo = pagination(c.req.query());

    if (!pageInfo) {
      return badRequest(c, "Invalid pagination");
    }

    if (!["name", "balance"].includes(sort)) {
      return badRequest(c, "Invalid sort");
    }

    const sortColumn =
      sort === "balance"
        ? "wallet_balance"
        : "name";

    const countResult = await query(
      `
      SELECT COUNT(*) AS total
      FROM guests
      WHERE name ILIKE '%' || $1 || '%'
      `,
      [q]
    );

    const result = await query(
      `
      SELECT
        id,
        name,
        wallet_balance
      FROM guests
      WHERE name ILIKE '%' || $1 || '%'
      ORDER BY ${sortColumn} ASC
      LIMIT $2 OFFSET $3
      `,
      [q, pageInfo.limit, pageInfo.offset]
    );

    return c.json({
      items: result.rows,
      page: pageInfo.page,
      limit: pageInfo.limit,
      total: Number(countResult.rows[0].total)
    });
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

/*
 * GET /api/guests/:id
 */
app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    if (!isUUID(id)) {
      return badRequest(c, "Malformed guest UUID");
    }

    const guestResult = await query(
      `
      SELECT
        id,
        name,
        wallet_balance
      FROM guests
      WHERE id = $1
      `,
      [id]
    );

    if (guestResult.rows.length === 0) {
      return c.json({
        error: {
          code: "NOT_FOUND",
          message: `Guest ${id} does not exist`,
          detail: {}
        }
      }, 404);
    }

    const guest = guestResult.rows[0];

    const activeResult = await query(
      `
      SELECT
        b.id,
        b.property_id,
        p.title AS property_title,
        b.status
      FROM bookings b
      JOIN properties p
        ON p.id = b.property_id
      WHERE b.guest_id = $1
        AND b.status = 'CHECKED_IN'
      LIMIT 1
      `,
      [id]
    );

    const countResult = await query(
      `
      SELECT
        COUNT(*) FILTER (
          WHERE status = 'CONFIRMED'
        ) AS confirmed,

        COUNT(*) FILTER (
          WHERE status = 'CHECKED_IN'
        ) AS checked_in,

        COUNT(*) FILTER (
          WHERE status = 'COMPLETED'
        ) AS completed

      FROM bookings
      WHERE guest_id = $1
      `,
      [id]
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
      WHERE guest_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
      `,
      [id]
    );

    const counts = countResult.rows[0];

    return c.json({
      ...guest,

      active_booking:
        activeResult.rows[0] || null,

      booking_counts: {
        CONFIRMED: Number(counts.confirmed),
        CHECKED_IN: Number(counts.checked_in),
        COMPLETED: Number(counts.completed)
      },

      latest_audit:
        auditResult.rows[0] || null
    });
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

/*
 * POST /api/guests/:id/top-up
 */
app.post("/:id/top-up", async (c) => {
  try {
    const id = c.req.param("id");

    if (!isUUID(id)) {
      return badRequest(c, "Malformed guest UUID");
    }

    let body;

    try {
      body = await c.req.json();
    } catch {
      return badRequest(c, "Invalid JSON body");
    }

    if (
      !body ||
      body.amount === undefined ||
      body.amount === null
    ) {
      return badRequest(c, "Amount must be a positive number");
    }

    const amount = parseMoney(body.amount);

    if (amount === null || amount <= 0) {
      return badRequest(c, "Amount must be a positive number");
    }

    const result = await query(
      `
      CALL sp_top_up_wallet(
        $1,
        $2,
        NULL,
        NULL,
        NULL
      )
      `,
      [id, amount]
    );

    const row = result.rows[0];

    if (!row) {
      return c.json({
        error: {
          code: "INTERNAL",
          message: "Top-up failed",
          detail: {}
        }
      }, 500);
    }

    const audit = await query(
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

    return c.json({
      balance_before: row.balance_before,
      balance_after: row.balance_after,
      audit_log: audit.rows[0] || null
    });
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

/*
 * GET /api/guests/:id/audit
 */
app.get("/:id/audit", async (c) => {
  try {
    const id = c.req.param("id");

    if (!isUUID(id)) {
      return badRequest(c, "Malformed guest UUID");
    }

    const pageInfo = pagination(c.req.query());

    if (!pageInfo) {
      return badRequest(c, "Invalid pagination");
    }

    const order = c.req.query("order") || "desc";

    if (!["asc", "desc"].includes(order)) {
      return badRequest(c, "Invalid order");
    }

    const from = c.req.query("from");
    const to = c.req.query("to");

    if (
      from &&
      !/^\d{4}-\d{2}-\d{2}$/.test(from)
    ) {
      return badRequest(c, "Invalid from date");
    }

    if (
      to &&
      !/^\d{4}-\d{2}-\d{2}$/.test(to)
    ) {
      return badRequest(c, "Invalid to date");
    }

    if (from && to && from > to) {
      return badRequest(c, "Invalid date range");
    }

    const guestCheck = await query(
      `
      SELECT id
      FROM guests
      WHERE id = $1
      `,
      [id]
    );

    if (guestCheck.rows.length === 0) {
      return c.json({
        error: {
          code: "NOT_FOUND",
          message: `Guest ${id} does not exist`,
          detail: {}
        }
      }, 404);
    }

    const conditions = ["guest_id = $1"];
    const params = [id];

    if (from) {
      params.push(from);

      conditions.push(
        `timestamp >= $${params.length}::date`
      );
    }

    if (to) {
      params.push(to);

      conditions.push(
        `timestamp < ($${params.length}::date + INTERVAL '1 day')`
      );
    }

    const where = conditions.join(" AND ");

    const countResult = await query(
      `
      SELECT COUNT(*) AS total
      FROM wallet_audit_logs
      WHERE ${where}
      `,
      params
    );

    const result = await query(
      `
      SELECT
        id,
        timestamp,
        action_type,
        amount_changed,

        CASE
          WHEN action_type = 'DEBIT'
            THEN -amount_changed
          ELSE amount_changed
        END AS signed_amount,

        balance_after

      FROM wallet_audit_logs

      WHERE ${where}

      ORDER BY timestamp ${order.toUpperCase()}

      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
      `,
      [
        ...params,
        pageInfo.limit,
        pageInfo.offset
      ]
    );

    /*
     * Opening balance:
     *
     * Balance immediately before the requested
     * date range.
     *
     * If there is no "from", use the balance before
     * the first transaction in the complete history.
     */
    let openingBalance = "0.00";

    if (from) {
      const before = await query(
        `
        SELECT balance_after
        FROM wallet_audit_logs

        WHERE guest_id = $1
          AND timestamp < $2::date

        ORDER BY timestamp DESC
        LIMIT 1
        `,
        [id, from]
      );

      if (before.rows.length > 0) {
        openingBalance = before.rows[0].balance_after;
      }
    } else {
      const before = await query(
        `
        SELECT balance_after
        FROM wallet_audit_logs

        WHERE guest_id = $1

        ORDER BY timestamp ASC
        LIMIT 1
        `,
        [id]
      );

      if (before.rows.length > 0) {
        const first = before.rows[0];

        const firstAudit = await query(
          `
          SELECT
            balance_after,
            amount_changed,
            action_type
          FROM wallet_audit_logs
          WHERE id = $1
          `,
          [first.id]
        );

        if (firstAudit.rows.length > 0) {
          const auditRow = firstAudit.rows[0];

          const firstBalance =
            Number(auditRow.balance_after);

          const amount =
            Number(auditRow.amount_changed);

          if (auditRow.action_type === "CREDIT") {
            openingBalance =
              (firstBalance - amount).toFixed(2);
          } else {
            openingBalance =
              (firstBalance + amount).toFixed(2);
          }
        }
      }
    }

    /*
     * Closing balance should represent the balance
     * at the chronologically LAST audit record in
     * the requested range.
     *
     * This is independent of whether the API displays
     * rows ASC or DESC.
     */
    let closingBalance = openingBalance;

    const closingResult = await query(
      `
      SELECT balance_after
      FROM wallet_audit_logs

      WHERE ${where}

      ORDER BY timestamp DESC

      LIMIT 1
      `,
      params
    );

    if (closingResult.rows.length > 0) {
      closingBalance =
        closingResult.rows[0].balance_after;
    }

    return c.json({
      items: result.rows,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      page: pageInfo.page,
      limit: pageInfo.limit,
      total: Number(countResult.rows[0].total)
    });
  } catch (error) {
    const e = errorResponse(error);
    return c.json(e.body, e.status);
  }
});

export default app;