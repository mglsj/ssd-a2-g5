import { randomUUID } from "crypto";

export function isUUID(value) {
  if (!value || typeof value !== "string") return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function positiveInt(value, defaultValue) {
  if (value === undefined) return defaultValue;

  const n = Number(value);

  if (!Number.isInteger(n) || n <= 0) {
    return null;
  }

  return n;
}

export function pagination(query) {
  const page = positiveInt(query.page, 1);
  const limit = positiveInt(query.limit, 20);

  if (page === null || limit === null || limit > 100) {
    return null;
  }

  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
}

export function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function newSessionId() {
  return randomUUID();
}