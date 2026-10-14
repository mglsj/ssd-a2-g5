// The tests run against the seeded databases. They add a few bookings, top-ups
// and search pins, which the append-only audit log keeps.
import app from "../src/app.ts";
import { sql } from "../src/db/postgres.ts";

export type Json = Record<string, any>;

export async function call(method: string, path: string, body?: unknown) {
  const response = await app.request(`/api${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, type: response.headers.get("content-type"), body: (await response.json()) as Json };
}

export const auditCount = async (guestId: string): Promise<number> =>
  (await sql`SELECT count(*)::int AS n FROM wallet_audit_logs WHERE guest_id = ${guestId}`)[0].n;

/** A guest with no active stay (the poorest one), plus the cheapest and dearest properties. */
export async function fixtures() {
  const [[guest], [cheap], [dear]] = await Promise.all([
    sql`
      SELECT g.id FROM guests g
      WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.guest_id = g.id AND b.status = 'CHECKED_IN')
      ORDER BY g.wallet_balance LIMIT 1
    `,
    sql`SELECT id FROM properties ORDER BY base_price LIMIT 1`,
    sql`SELECT id FROM properties ORDER BY base_price DESC LIMIT 1`,
  ]);
  return { guestId: guest.id as string, cheapPropertyId: cheap.id as string, dearPropertyId: dear.id as string };
}

export async function book(guestId: string, propertyId: string, nights = 1) {
  return (await call("POST", "/bookings", { guest_id: guestId, property_id: propertyId, nights })).body.booking;
}
