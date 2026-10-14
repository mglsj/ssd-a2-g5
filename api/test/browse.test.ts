import { describe, expect, test } from "bun:test";
import { call, type Json } from "./helpers.ts";

describe("guest switcher filters for the demo", () => {
  test("has_active_stay picks guests who can show the second check-in", async () => {
    const { body } = await call("GET", "/guests?has_active_stay=true&limit=3");
    expect(body.items.length).toBeGreaterThan(0);
    for (const guest of body.items) {
      expect((await call("GET", `/guests/${guest.id}`)).body.active_booking).not.toBeNull();
    }
    const without = await call("GET", "/guests?has_active_stay=false&limit=1");
    expect(body.total + without.body.total).toBe((await call("GET", "/guests?limit=1")).body.total);
  });

  test("balance_asc puts the poorest guest first", async () => {
    const { body } = await call("GET", "/guests?sort=balance_asc&limit=5");
    const balances = body.items.map((g: Json) => Number(g.wallet_balance));
    expect(balances).toEqual([...balances].sort((a, b) => a - b));
  });
});

describe("properties near a point", () => {
  test("sort=distance lists nearby properties nearest first", async () => {
    const { status, body } = await call("GET", "/properties?lat=17.4455&lng=78.3489&radius=3000&sort=distance&limit=10");
    expect(status).toBe(200);
    const distances = body.items.map((p: Json) => p.distance_meters);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(distances.every((d: number) => d <= 3000)).toBe(true);
  });

  test("distance sorting without a centre is rejected", async () => {
    expect((await call("GET", "/properties?sort=distance")).status).toBe(400);
    expect((await call("GET", "/properties?lat=17.4")).status).toBe(400);
  });
});

describe("analytics defaults", () => {
  test("the moving average charts the top 5 up to the latest revenue day", async () => {
    const { status, body } = await call("GET", "/analytics/moving-average");
    expect(status).toBe(200);
    const rank = (await call("GET", "/analytics/rank?limit=5")).body;
    expect(body.to).toBe(rank.as_of);
    expect(body.series).toHaveLength(5);
    expect(body.series.map((s: Json) => s.property_id)).toEqual(rank.items.slice(0, 5).map((r: Json) => r.property_id));
    expect(body.series[0].points).toHaveLength(90);
    expect(body.series[0].points.at(-1).day).toBe(body.to);
  });

  test("a range over 366 days is rejected", async () => {
    const { status } = await call("GET", "/analytics/moving-average?from=2024-01-01&to=2026-01-01");
    expect(status).toBe(400);
  });
});
