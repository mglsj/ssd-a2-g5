import { createRoute } from "@hono/zod-openapi";
import { errors, json } from "../../shared/openapi.ts";
import { IdParam, paged } from "../../shared/schemas.ts";
import { Guest, GuestDetail, GuestListQuery } from "./guests.schemas.ts";

export const list = createRoute({
  method: "get",
  path: "/",
  tags: ["Guests"],
  summary: "List guests",
  request: { query: GuestListQuery },
  responses: { 200: json(paged(Guest), "A page of guests"), ...errors(400) },
});

export const detail = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Guests"],
  summary: "One guest with their active stay, booking counts and latest audit row",
  request: { params: IdParam },
  responses: { 200: json(GuestDetail, "The guest"), ...errors(400, 404) },
});
