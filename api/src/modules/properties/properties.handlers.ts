import { notFound } from "../../shared/errors/api-error.ts";
import type { Handler } from "../../shared/openapi.ts";
import * as properties from "./properties.repository.ts";
import type * as routes from "./properties.routes.ts";

export const list: Handler<typeof routes.list> = async (c) =>
  c.json(await properties.listProperties(c.req.valid("query")), 200);

export const detail: Handler<typeof routes.detail> = async (c) => {
  const { id } = c.req.valid("param");
  const property = await properties.findProperty(id);
  if (!property) throw notFound("Property", id);
  return c.json(property, 200);
};

export const amenities: Handler<typeof routes.amenities> = async (c) => {
  const { id } = c.req.valid("param");
  const document = await properties.findAmenities(id);
  if (!document) throw notFound("Amenities for property", id);
  return c.json(document, 200);
};
