import { notFound } from "../../shared/errors/api-error.ts";
import type { Handler } from "../../shared/openapi.ts";
import * as bookings from "./bookings.repository.ts";
import type * as routes from "./bookings.routes.ts";

export const list: Handler<typeof routes.list> = async (c) => c.json(await bookings.listBookings(c.req.valid("query")), 200);

export const create: Handler<typeof routes.create> = async (c) =>
  c.json(await bookings.createBooking(c.req.valid("json")), 201);

export const detail: Handler<typeof routes.detail> = async (c) => {
  const { id } = c.req.valid("param");
  const booking = await bookings.findBooking(id);
  if (!booking) throw notFound("Booking", id);
  return c.json(booking, 200);
};

export const updateStatus: Handler<typeof routes.updateStatus> = async (c) => {
  const { id } = c.req.valid("param");
  const { status } = c.req.valid("json");
  return c.json(await bookings.updateBookingStatus(id, status), 200);
};
