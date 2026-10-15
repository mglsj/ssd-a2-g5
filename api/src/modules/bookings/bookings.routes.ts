import { createRoute } from "@hono/zod-openapi";
import { errors, json, jsonBody } from "../../shared/openapi.ts";
import { IdParam, paged } from "../../shared/schemas.ts";
import {
  Booking,
  BookingCreated,
  BookingListQuery,
  CreateBookingBody,
  StatusChanged,
  UpdateStatusBody,
} from "./bookings.schemas.ts";

export const list = createRoute({
  method: "get",
  path: "/",
  tags: ["Bookings"],
  summary: "List bookings, newest first",
  request: { query: BookingListQuery },
  responses: { 200: json(paged(Booking), "A page of bookings"), ...errors(400) },
});

export const create = createRoute({
  method: "post",
  path: "/",
  tags: ["Bookings"],
  summary: "Book a stay with sp_execute_booking (Workflow 1)",
  description:
    "The procedure locks the guest row, deducts `base_price * nights`, inserts a CONFIRMED booking and the trigger writes a DEBIT audit row, all in one transaction. " +
    "`INSUFFICIENT_BALANCE` carries `{ total_cost, balance }` in `detail`.",
  request: { body: jsonBody(CreateBookingBody) },
  responses: { 201: json(BookingCreated, "The booking and the wallet change"), ...errors(400, 404, 409, 422) },
});

export const detail = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Bookings"],
  summary: "One booking",
  request: { params: IdParam },
  responses: { 200: json(Booking, "The booking"), ...errors(400, 404) },
});

export const updateStatus = createRoute({
  method: "patch",
  path: "/{id}/status",
  tags: ["Bookings"],
  summary: "Move a booking forward with sp_update_booking_status",
  description:
    "Only CONFIRMED to CHECKED_IN and CHECKED_IN to COMPLETED are allowed (`INVALID_TRANSITION` otherwise, with `{ from, to }`). " +
    "A check-in before the booking's `check_in_date` returns `TOO_EARLY_TO_CHECK_IN` with `{ check_in_date }`. " +
    "A second check-in for the same guest hits the partial unique index `idx_active_stay` and returns `ALREADY_CHECKED_IN` with `{ active_booking_id }`.",
  request: { params: IdParam, body: jsonBody(UpdateStatusBody) },
  responses: { 200: json(StatusChanged, "The updated booking"), ...errors(400, 404, 409) },
});
