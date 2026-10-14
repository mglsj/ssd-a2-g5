import { z } from "@hono/zod-openapi";
import { Money, PageQuery, Uuid } from "../../shared/schemas.ts";
import { AuditEntry } from "../wallet/wallet.schemas.ts";

export const Guest = z.object({ id: Uuid, name: z.string(), wallet_balance: Money }).openapi("Guest");

export const GuestDetail = Guest.extend({
  active_booking: z
    .object({ id: Uuid, property_id: Uuid, property_title: z.string(), status: z.literal("CHECKED_IN") })
    .nullable(),
  booking_counts: z.object({
    CONFIRMED: z.number().int(),
    CHECKED_IN: z.number().int(),
    COMPLETED: z.number().int(),
  }),
  latest_audit: AuditEntry.nullable(),
}).openapi("GuestDetail");

export const GuestListQuery = PageQuery.extend({
  q: z.string().max(100).default("").openapi({ description: "Case-insensitive name search" }),
  sort: z.enum(["name", "balance_desc", "balance_asc"]).default("name"),
  has_active_stay: z
    .stringbool()
    .optional()
    .openapi({ type: "boolean", description: "true: only guests with a CHECKED_IN booking. false: only guests without one" }),
});

export type Guest = z.infer<typeof Guest>;
export type GuestDetail = z.infer<typeof GuestDetail>;
export type GuestListQuery = z.infer<typeof GuestListQuery>;
