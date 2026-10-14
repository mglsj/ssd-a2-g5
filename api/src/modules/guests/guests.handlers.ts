import { notFound } from "../../shared/errors/api-error.ts";
import type { Handler } from "../../shared/openapi.ts";
import * as guests from "./guests.repository.ts";
import type * as routes from "./guests.routes.ts";

export const list: Handler<typeof routes.list> = async (c) => c.json(await guests.listGuests(c.req.valid("query")), 200);

export const detail: Handler<typeof routes.detail> = async (c) => {
  const { id } = c.req.valid("param");
  const guest = await guests.findGuest(id);
  if (!guest) throw notFound("Guest", id);
  return c.json(guest, 200);
};
