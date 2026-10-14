import { notFound } from "../../shared/errors/api-error.ts";
import type { Handler } from "../../shared/openapi.ts";
import * as wallet from "./wallet.repository.ts";
import type * as routes from "./wallet.routes.ts";

export const topUp: Handler<typeof routes.topUp> = async (c) => {
  const { id } = c.req.valid("param");
  const { amount } = c.req.valid("json");
  return c.json(await wallet.topUp(id, amount), 200);
};

export const auditTrail: Handler<typeof routes.auditTrail> = async (c) => {
  const { id } = c.req.valid("param");
  const trail = await wallet.findAuditTrail(id, c.req.valid("query"));
  if (!trail) throw notFound("Guest", id);
  return c.json(trail, 200);
};
