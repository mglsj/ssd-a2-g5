import { sql } from "../../db/postgres.ts";
import { escapeLike } from "../../shared/like.ts";
import { offset, type Paged } from "../../shared/schemas.ts";
import { findLatestAuditEntry } from "../wallet/wallet.repository.ts";
import type { Guest, GuestDetail, GuestListQuery } from "./guests.schemas.ts";

export async function listGuests(query: GuestListQuery): Promise<Paged<Guest>> {
  const pattern = `%${escapeLike(query.q)}%`;
  const activeStay = () => sql`EXISTS (SELECT 1 FROM bookings b WHERE b.guest_id = g.id AND b.status = 'CHECKED_IN')`;
  const where = () => sql`
    name ILIKE ${pattern}
    ${query.has_active_stay === undefined ? sql`` : query.has_active_stay ? sql`AND ${activeStay()}` : sql`AND NOT ${activeStay()}`}
  `;
  const order = {
    name: sql`name, id`,
    balance_desc: sql`g.wallet_balance DESC, g.id`,
    balance_asc: sql`g.wallet_balance, g.id`,
  }[query.sort];
  const [[count], items] = await Promise.all([
    sql`SELECT count(*)::int AS total FROM guests g WHERE ${where()}`,
    sql`
      SELECT id, name, wallet_balance::text
      FROM guests g
      WHERE ${where()}
      ORDER BY ${order}
      LIMIT ${query.limit} OFFSET ${offset(query)}
    `,
  ]);
  return { items, page: query.page, limit: query.limit, total: count.total };
}

export async function findGuest(id: string): Promise<GuestDetail | null> {
  const [[guest], [active], [counts], latest] = await Promise.all([
    sql`SELECT id, name, wallet_balance::text FROM guests WHERE id = ${id}`,
    sql`
      SELECT b.id, b.property_id, p.title AS property_title, b.status
      FROM bookings b JOIN properties p ON p.id = b.property_id
      WHERE b.guest_id = ${id} AND b.status = 'CHECKED_IN'
    `,
    sql`
      SELECT
        count(*) FILTER (WHERE status = 'CONFIRMED')::int AS "CONFIRMED",
        count(*) FILTER (WHERE status = 'CHECKED_IN')::int AS "CHECKED_IN",
        count(*) FILTER (WHERE status = 'COMPLETED')::int AS "COMPLETED"
      FROM bookings WHERE guest_id = ${id}
    `,
    findLatestAuditEntry(id),
  ]);
  if (!guest) return null;
  return { ...guest, active_booking: active ?? null, booking_counts: counts, latest_audit: latest };
}
