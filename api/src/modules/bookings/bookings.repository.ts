import { money, sql } from "../../db/postgres.ts";
import { ApiError } from "../../shared/errors/api-error.ts";
import { isPostgresError } from "../../shared/errors/to-api-error.ts";
import { offset, type Paged } from "../../shared/schemas.ts";
import { findAuditEntry } from "../wallet/wallet.repository.ts";
import type {
  Booking,
  BookingCreated,
  BookingListQuery,
  BookingStatus,
  CreateBookingBody,
  StatusChanged,
} from "./bookings.schemas.ts";

const bookingColumns = () => sql`
  b.id, b.guest_id, g.name AS guest_name, b.property_id, p.title AS property_title,
  b.nights, b.total_cost::text, b.status, b.created_at
`;
const withNames = () => sql`
  bookings b
  JOIN guests g ON g.id = b.guest_id
  JOIN properties p ON p.id = b.property_id
`;

export async function listBookings(query: BookingListQuery): Promise<Paged<Booking>> {
  const where = () =>
    [
      query.guest_id && sql`b.guest_id = ${query.guest_id}`,
      query.property_id && sql`b.property_id = ${query.property_id}`,
      query.status && sql`b.status = ${query.status}`,
    ]
      .filter(Boolean)
      .reduce((all, next) => sql`${all} AND ${next}`, sql`WHERE TRUE`);
  const [[count], items] = await Promise.all([
    sql`SELECT count(*)::int AS total FROM bookings b ${where()}`,
    sql`
      SELECT ${bookingColumns()} FROM ${withNames()}
      ${where()}
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT ${query.limit} OFFSET ${offset(query)}
    `,
  ]);
  return { items, page: query.page, limit: query.limit, total: count.total };
}

export async function findBooking(id: string): Promise<Booking | null> {
  const [booking] = await sql`SELECT ${bookingColumns()} FROM ${withNames()} WHERE b.id = ${id}`;
  return booking ?? null;
}

/** Workflow 1. Database errors (insufficient balance, unknown guest) propagate to the error handler. */
export async function createBooking(body: CreateBookingBody): Promise<BookingCreated> {
  const [result] = await sql`
    CALL sp_execute_booking(${body.guest_id}::uuid, ${body.property_id}::uuid, ${body.nights}::int,
      NULL, NULL, NULL, NULL, NULL)
  `;
  const [booking, auditLog] = await Promise.all([findBooking(result.booking_id), findAuditEntry(result.audit_log_id)]);
  return {
    booking: booking!,
    balance_before: money(result.balance_before),
    balance_after: money(result.balance_after),
    audit_log: auditLog,
  };
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<StatusChanged> {
  try {
    const [result] = await sql`CALL sp_update_booking_status(${id}::uuid, ${status}, NULL)`;
    return { booking: (await findBooking(id))!, previous_status: result.previous_status };
  } catch (error) {
    // 22023 from this procedure means a forbidden transition, not bad input.
    if (isPostgresError(error) && error.errno === "22023") {
      const match = error.message.match(/A (\w+) booking cannot move to (\w+)/);
      throw new ApiError(409, "INVALID_TRANSITION", error.message, match ? { from: match[1], to: match[2] } : {});
    }
    throw error;
  }
}
