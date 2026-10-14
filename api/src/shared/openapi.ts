import { OpenAPIHono, type RouteConfig, type RouteHandler, type z } from "@hono/zod-openapi";
import { validationHook } from "./middleware/validation-hook.ts";
import { ErrorSchema } from "./schemas.ts";

export const createRouter = () => new OpenAPIHono({ defaultHook: validationHook });

export type Handler<R extends RouteConfig> = RouteHandler<R>;

export const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

export const GEOJSON = "application/geo+json";

export const geoJson = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { [GEOJSON]: { schema } } as { "application/geo+json": { schema: T } },
});

export const jsonBody =<T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

const errorDescriptions = {
  400: "Malformed request",
  404: "Record not found",
  409: "Conflicts with the current state",
  422: "Rejected by the database",
  503: "A database is unavailable",
} as const;

export function errors(...statuses: (keyof typeof errorDescriptions)[]) {
  return Object.fromEntries(statuses.map((status) => [status, json(ErrorSchema, errorDescriptions[status])]));
}
