import type { ContentfulStatusCode } from "hono/utils/http-status";

export type ErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "INVALID_TRANSITION"
  | "INSUFFICIENT_BALANCE"
  | "ALREADY_CHECKED_IN"
  | "NO_COMPLETED_STAY"
  | "ALREADY_REVIEWED"
  | "DB_UNAVAILABLE"
  | "INTERNAL";

export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ErrorCode,
    message: string,
    readonly detail: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const notFound = (what: string, id: string) =>
  new ApiError(404, "NOT_FOUND", `${what} ${id} does not exist`);

export const errorBody = (error: ApiError) => ({
  error: { code: error.code, message: error.message, detail: error.detail },
});
