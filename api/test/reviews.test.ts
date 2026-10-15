import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "../src/db/postgres.ts";
import { book, call, fixtures } from "./helpers.ts";

let guestId: string;
let propertyId: string;

const review = (extra = {}) => ({
  guest_id: guestId,
  property_id: propertyId,
  rating: 4,
  review_text: "Clean room and a quick walk to the office.",
  location_tags: ["walkable", "it_corridor"],
  ...extra,
});

const completeStay = async () => {
  const booking = await book(guestId, propertyId);
  await call("PATCH", `/bookings/${booking.id}/status`, { status: "CHECKED_IN" });
  await call("PATCH", `/bookings/${booking.id}/status`, { status: "COMPLETED" });
  return booking.id as string;
};

beforeAll(async () => {
  ({ guestId, cheapPropertyId: propertyId } = await fixtures());
  await call("POST", `/guests/${guestId}/top-up`, { amount: 50000 });
});

describe("leaving a review", () => {
  test("a guest with no completed stay is refused", async () => {
    const [stranger] = await sql`
      SELECT g.id FROM guests g
      WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.guest_id = g.id AND b.property_id = ${propertyId})
      LIMIT 1
    `;
    const asked = await call("GET", `/reviews/eligibility?guest_id=${stranger.id}&property_id=${propertyId}`);
    expect(asked.body).toEqual({ eligible: false, booking_id: null, reason: "NO_COMPLETED_STAY" });

    const result = await call("POST", "/reviews", review({ guest_id: stranger.id }));
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe("NO_COMPLETED_STAY");
  });

  test("a confirmed stay does not count", async () => {
    const [stranger] = await sql`
      SELECT g.id FROM guests g
      WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.guest_id = g.id AND b.property_id = ${propertyId})
      ORDER BY g.wallet_balance DESC LIMIT 1
    `;
    await call("POST", `/guests/${stranger.id}/top-up`, { amount: 50000 });
    await book(stranger.id, propertyId);
    const result = await call("POST", "/reviews", review({ guest_id: stranger.id }));
    expect(result.status).toBe(403);
  });

  test("a completed stay can be reviewed once", async () => {
    const bookingId = await completeStay();
    const before = await call("GET", `/reviews/eligibility?guest_id=${guestId}&property_id=${propertyId}`);
    expect(before.body.eligible).toBe(true);

    const created = await call("POST", "/reviews", review());
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ guest_id: guestId, property_id: propertyId, rating: 4 });
    expect(created.body.booking_id).toBe(before.body.booking_id);

    const listed = await call("GET", `/reviews?property_id=${propertyId}&limit=5`);
    expect(listed.body.items.map((r: { id: string }) => r.id)).toContain(created.body.id);
    expect(bookingId).toBeString();
  });

  test("every completed stay reviewed means no more reviews", async () => {
    for (let guard = 0; guard < 20; guard++) {
      const answer = await call("GET", `/reviews/eligibility?guest_id=${guestId}&property_id=${propertyId}`);
      if (!answer.body.eligible) break;
      expect((await call("POST", "/reviews", review())).status).toBe(201);
    }
    const again = await call("POST", "/reviews", review());
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ALREADY_REVIEWED");
  });

  test("bad ratings and tags are rejected", async () => {
    expect((await call("POST", "/reviews", review({ rating: 6 }))).status).toBe(400);
    expect((await call("POST", "/reviews", review({ location_tags: [] }))).status).toBe(400);
    expect((await call("POST", "/reviews", review({ location_tags: ["made_up"] }))).status).toBe(400);
  });
});
