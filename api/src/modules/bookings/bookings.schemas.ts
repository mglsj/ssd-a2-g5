import { z } from "@hono/zod-openapi";
import { Money, PageQuery, Timestamp, Uuid } from "../../shared/schemas.ts";
import { AuditEntry } from "../wallet/wallet.schemas.ts";

export const BookingStatus = z.enum(["CONFIRMED", "CHECKED_IN", "COMPLETED"]);

export const Booking = z
  .object({
    id: Uuid,
    guest_id: Uuid,
    guest_name: z.string(),
    property_id: Uuid,
    property_title: z.string(),
    nights: z.number().int(),
    total_cost: Money,
    status: BookingStatus,
    created_at: Timestamp,
  })
  .openapi("Booking");

export const BookingListQuery = PageQuery.extend({
  guest_id: Uuid.optional(),
  property_id: Uuid.optional(),
  status: BookingStatus.optional(),
});

export const CreateBookingBody = z.object({
  guest_id: Uuid,
  property_id: Uuid,
  nights: z.number().int().min(1).max(365).openapi({ example: 3 }),
});

export const BookingCreated = z
  .object({ booking: Booking, balance_before: Money, balance_after: Money, audit_log: AuditEntry })
  .openapi("BookingCreated");

export const UpdateStatusBody = z.object({ status: BookingStatus });

export const StatusChanged = z.object({ booking: Booking, previous_status: BookingStatus });

export type BookingStatus = z.infer<typeof BookingStatus>;
export type Booking = z.infer<typeof Booking>;
export type BookingListQuery = z.infer<typeof BookingListQuery>;
export type CreateBookingBody = z.infer<typeof CreateBookingBody>;
export type BookingCreated = z.infer<typeof BookingCreated>;
export type StatusChanged = z.infer<typeof StatusChanged>;
