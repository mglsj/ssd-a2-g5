import { HTTPException } from "hono/http-exception";
import { MongoNetworkError, MongoServerError, MongoServerSelectionError } from "mongodb";
import { ApiError } from "./api-error.ts";

type PostgresError = Error & { errno: string; code: string; constraint?: string };

export function isPostgresError(error: unknown): error is PostgresError {
  return error instanceof Error && error.name === "PostgresError" && "errno" in error;
}

function fromPostgres(error: PostgresError): ApiError | undefined {
  switch (error.errno) {
    case "P0002":
      return new ApiError(404, "NOT_FOUND", error.message);
    case "22023":
      return new ApiError(422, "INVALID_INPUT", error.message);
    case "22003":
      return new ApiError(422, "INVALID_INPUT", "The amount is too large: a wallet holds at most 99,999,999.99");
    case "23514":
      if (error.constraint === "chk_guests_wallet_nonnegative") {
        const match = error.message.match(/costs ([\d.]+) but the wallet has ([\d.]+)/);
        return new ApiError(
          409,
          "INSUFFICIENT_BALANCE",
          error.message,
          match ? { total_cost: match[1], balance: match[2] } : {},
        );
      }
      return;
    case "23505":
      if (error.constraint === "idx_active_stay") {
        const match = error.message.match(/booking ([0-9a-f-]{36})/i);
        return new ApiError(409, "ALREADY_CHECKED_IN", error.message, {
          active_booking_id: match?.[1] ?? null,
        });
      }
      return;
  }
}

const unavailable = () => new ApiError(503, "DB_UNAVAILABLE", "Database unavailable");

function internal(error: unknown) {
  console.error(error);
  return new ApiError(500, "INTERNAL", "Internal server error");
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof HTTPException) {
    return new ApiError(400, "BAD_REQUEST", error.message || "Bad request");
  }
  if (isPostgresError(error)) {
    if (error.errno) return fromPostgres(error) ?? internal(error);
    if (/CONNECTION|TIMEOUT/.test(error.code)) return unavailable();
  }
  if (error instanceof MongoServerError && error.code === 121) {
    return new ApiError(422, "INVALID_INPUT", "Document failed collection validation", {
      errInfo: error.errInfo ?? null,
    });
  }
  if (error instanceof MongoServerSelectionError || error instanceof MongoNetworkError) {
    return unavailable();
  }
  if (error instanceof Error && "code" in error && error.code === "ECONNREFUSED") {
    return unavailable();
  }
  return internal(error);
}
