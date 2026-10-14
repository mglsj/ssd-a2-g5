import { createRoute } from "@hono/zod-openapi";
import { json } from "../../shared/openapi.ts";
import { Health } from "./health.schemas.ts";

export const check = createRoute({
  method: "get",
  path: "/",
  tags: ["Health"],
  summary: "Check both databases",
  responses: {
    200: json(Health, "Both databases answer"),
    503: json(Health, "At least one database is down"),
  },
});
