import { expect, test } from "bun:test";
import app from "../src/app.ts";
import { createClient } from "../src/client.ts";

// Runs the typed client against the app in process. If a route's types drift,
// the type check fails here before the front end notices.
const api = createClient("http://localhost", {
  fetch: ((input, init) => app.request(input, init)) as typeof fetch,
});

test("the typed client calls the API with typed inputs and outputs", async () => {
  const response = await api.api.guests.$get({ query: { sort: "balance_desc", limit: "1" } });
  expect(response.status).toBe(200);
  if (response.status !== 200) return;
  const page = await response.json();
  const guest = page.items[0]!;
  expect(typeof guest.wallet_balance).toBe("string");

  const detail = await api.api.guests[":id"].$get({ param: { id: guest.id } });
  expect(detail.status).toBe(200);
});
