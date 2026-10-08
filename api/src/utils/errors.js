export function errorResponse(error) {
  console.error(error);

  if (error?.code === "P0002") {
    return {
      status: 404,
      body: {
        error: {
          code: "NOT_FOUND",
          message: error.message,
          detail: {}
        }
      }
    };
  }

  if (error?.code === "22023") {
    return {
      status: 422,
      body: {
        error: {
          code: "INVALID_INPUT",
          message: error.message,
          detail: {}
        }
      }
    };
  }

  if (
    error?.code === "23514" &&
    error?.constraint === "chk_guests_wallet_nonnegative"
  ) {
    return {
      status: 409,
      body: {
        error: {
          code: "INSUFFICIENT_BALANCE",
          message: error.message,
          detail: {}
        }
      }
    };
  }

  if (
    error?.code === "23505" &&
    error?.constraint === "idx_active_stay"
  ) {
    const match = error.message.match(/booking ([0-9a-f-]+)/i);

    return {
      status: 409,
      body: {
        error: {
          code: "ALREADY_CHECKED_IN",
          message: error.message,
          detail: {
            active_booking_id: match ? match[1] : null
          }
        }
      }
    };
  }

  if (error?.code === "121") {
    return {
      status: 422,
      body: {
        error: {
          code: "INVALID_INPUT",
          message: error.message,
          detail: {}
        }
      }
    };
  }

  if (
    error?.message?.includes("ECONNREFUSED") ||
    error?.message?.includes("Connection terminated") ||
    error?.code === "ECONNREFUSED"
  ) {
    return {
      status: 503,
      body: {
        error: {
          code: "DB_UNAVAILABLE",
          message: "Database unavailable",
          detail: {}
        }
      }
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL",
        message: "Internal server error",
        detail: {}
      }
    }
  };
}

export function badRequest(c, message) {
  return c.json(
    {
      error: {
        code: "BAD_REQUEST",
        message,
        detail: {}
      }
    },
    400
  );
}