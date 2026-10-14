import type { Hook } from "@hono/zod-openapi";
import { ApiError, errorBody } from "../errors/api-error.ts";

export const validationHook: Hook<unknown, any, string, unknown> = (result, c) => {
  if (result.success) return;
  const issues = result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  const message = issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; ");
  return c.json(errorBody(new ApiError(400, "BAD_REQUEST", message, { issues })), 400);
};
