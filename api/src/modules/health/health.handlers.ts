import type { Handler } from "../../shared/openapi.ts";
import { checkDatabases } from "./health.repository.ts";
import type * as routes from "./health.routes.ts";

export const check: Handler<typeof routes.check> = async (c) => {
  const health = await checkDatabases();
  return health.postgres === "ok" && health.mongo === "ok" ? c.json(health, 200) : c.json(health, 503);
};
