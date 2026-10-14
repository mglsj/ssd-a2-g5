import { createRoute } from "@hono/zod-openapi";
import { errors, json } from "../../shared/openapi.ts";
import { IdParam, paged } from "../../shared/schemas.ts";
import { Amenities, PropertyDetail, PropertyListItem, PropertyListQuery } from "./properties.schemas.ts";

export const list = createRoute({
  method: "get",
  path: "/",
  tags: ["Properties"],
  summary: "List properties",
  request: { query: PropertyListQuery },
  responses: { 200: json(paged(PropertyListItem), "A page of properties"), ...errors(400) },
});

export const detail = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Properties"],
  summary: "One property with its materialized view summary",
  request: { params: IdParam },
  responses: { 200: json(PropertyDetail, "The property"), ...errors(400, 404) },
});

export const amenities = createRoute({
  method: "get",
  path: "/{id}/amenities",
  tags: ["Properties"],
  summary: "The PropertyAmenities catalog document",
  request: { params: IdParam },
  responses: { 200: json(Amenities, "The catalog document"), ...errors(400, 404) },
});
