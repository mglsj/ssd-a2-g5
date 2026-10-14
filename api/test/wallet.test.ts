import { beforeAll, describe, expect, test } from "bun:test";
import { call, fixtures } from "./helpers.ts";

let guestId: string;

beforeAll(async () => {
  ({ guestId } = await fixtures());
});

describe("wallet", () => {
  test("a top-up credits the wallet and returns the audit row", async () => {
    const { status, body } = await call("POST", `/guests/${guestId}/top-up`, { amount: "10.50" });
    expect(status).toBe(200);
    expect(Number(body.balance_after) - Number(body.balance_before)).toBeCloseTo(10.5, 2);
    expect(body.audit_log).toMatchObject({ action_type: "CREDIT", amount_changed: "10.50" });
  });

  test("top-ups that the wallet cannot hold are refused", async () => {
    expect((await call("POST", `/guests/${guestId}/top-up`, { amount: 0 })).status).toBe(400);
    expect((await call("POST", `/guests/${guestId}/top-up`, { amount: 1.234 })).status).toBe(400);
    const overflow = await call("POST", `/guests/${guestId}/top-up`, { amount: 99999999.99 });
    expect(overflow.status).toBe(422);
    expect(overflow.body.error.code).toBe("INVALID_INPUT");
  });

  test("audit rows add up from the opening to the closing balance", async () => {
    const { status, body } = await call("GET", `/guests/${guestId}/audit?order=asc&limit=100`);
    expect(status).toBe(200);
    expect(body.total).toBe(body.items.length);
    let running = Number(body.opening_balance);
    for (const row of body.items) {
      running += Number(row.signed_amount);
      expect(running).toBeCloseTo(Number(row.balance_after), 2);
    }
    expect(running).toBeCloseTo(Number(body.closing_balance), 2);
  });

  test("a reversed date range is rejected", async () => {
    const { status } = await call("GET", `/guests/${guestId}/audit?from=2026-09-30&to=2026-09-01`);
    expect(status).toBe(400);
  });
});
