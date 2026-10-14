import type { ErrorHandler, NotFoundHandler } from "hono";
import { ApiError, errorBody } from "../errors/api-error.ts";
import { toApiError } from "../errors/to-api-error.ts";

export const onError: ErrorHandler = (error, c) => {
  const apiError = toApiError(error);
  return c.json(errorBody(apiError), apiError.status);
};

export const notFoundHandler: NotFoundHandler = (c) =>
  c.json(errorBody(new ApiError(404, "NOT_FOUND", `No route for ${c.req.method} ${c.req.path}`)), 404);
