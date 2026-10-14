import { beforeAll, describe, expect, test } from "bun:test";
import { auditCount, book, call, fixtures } from "./helpers.ts";

let guestId: string;
let cheapPropertyId: string;
let dearPropertyId: string;

beforeAll(async () => {
  ({ guestId, cheapPropertyId, dearPropertyId } = await fixtures());
});

describe("booking a stay (Workflow 1)", () => {
  test("an unaffordable booking is refused and changes nothing", async () => {
    const before = (await call("GET", `/guests/${guestId}`)).body;
    const logs = await auditCount(guestId);

    const result = await call("POST", "/bookings", { guest_id: guestId, property_id: dearPropertyId, nights: 365 });

    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe("INSUFFICIENT_BALANCE");
    expect(result.body.error.detail.balance).toBe(before.wallet_balance);
    expect((await call("GET", `/guests/${guestId}`)).body.wallet_balance).toBe(before.wallet_balance);
    expect(await auditCount(guestId)).toBe(logs);
  });

  test("a successful booking debits the wallet and the trigger logs it", async () => {
    await call("POST", `/guests/${guestId}/top-up`, { amount: 50000 });

    const result = await call("POST", "/bookings", { guest_id: guestId, property_id: cheapPropertyId, nights: 2 });

    expect(result.status).toBe(201);
    const { booking, balance_before, balance_after, audit_log } = result.body;
    expect(booking.status).toBe("CONFIRMED");
    expect(Number(balance_before) - Number(balance_after)).toBeCloseTo(Number(booking.total_cost), 2);
    expect(audit_log).toMatchObject({ action_type: "DEBIT", amount_changed: booking.total_cost, balance_after });
  });

  test("unknown guests and bad input are reported, not crashed on", async () => {
    const unknown = await call("POST", "/bookings", {
      guest_id: "00000000-0000-4000-8000-000000000000",
      property_id: cheapPropertyId,
      nights: 1,
    });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("NOT_FOUND");

    const zeroNights = await call("POST", "/bookings", { guest_id: guestId, property_id: cheapPropertyId, nights: 0 });
    expect(zeroNights.status).toBe(400);
    expect(zeroNights.body.error.code).toBe("BAD_REQUEST");

    const badId = await call("POST", "/bookings", { guest_id: "nope", property_id: cheapPropertyId, nights: 1 });
    expect(badId.status).toBe(400);
  });
});

describe("booking statuses and idx_active_stay", () => {
  test("a guest cannot be checked in twice", async () => {
    await call("POST", `/guests/${guestId}/top-up`, { amount: 50000 });
    const first = await book(guestId, cheapPropertyId);
    const second = await book(guestId, cheapPropertyId);

    const skip = await call("PATCH", `/bookings/${first.id}/status`, { status: "COMPLETED" });
    expect(skip.status).toBe(409);
    expect(skip.body.error).toMatchObject({ code: "INVALID_TRANSITION", detail: { from: "CONFIRMED", to: "COMPLETED" } });

    const checkIn = await call("PATCH", `/bookings/${first.id}/status`, { status: "CHECKED_IN" });
    expect(checkIn.status).toBe(200);
    expect(checkIn.body.previous_status).toBe("CONFIRMED");

    const clash = await call("PATCH", `/bookings/${second.id}/status`, { status: "CHECKED_IN" });
    expect(clash.status).toBe(409);
    expect(clash.body.error).toMatchObject({ code: "ALREADY_CHECKED_IN", detail: { active_booking_id: first.id } });

    expect((await call("PATCH", `/bookings/${first.id}/status`, { status: "COMPLETED" })).status).toBe(200);
    expect((await call("PATCH", `/bookings/${second.id}/status`, { status: "CHECKED_IN" })).status).toBe(200);
    expect((await call("PATCH", `/bookings/${second.id}/status`, { status: "COMPLETED" })).status).toBe(200);
  });
});
