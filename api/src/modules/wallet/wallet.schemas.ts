import { z } from "@hono/zod-openapi";
import { IsoDate, Money, PageQuery, paged, Timestamp, Uuid } from "../../shared/schemas.ts";

export const AuditEntry = z
  .object({
    id: Uuid,
    action_type: z.enum(["DEBIT", "CREDIT"]),
    amount_changed: Money,
    balance_after: Money,
    timestamp: Timestamp,
  })
  .openapi("AuditEntry");

export const AuditRow = AuditEntry.extend({ signed_amount: Money }).openapi("AuditRow");

export const AuditTrail = paged(AuditRow)
  .extend({ opening_balance: Money, closing_balance: Money })
  .openapi("AuditTrail");

export const AuditQuery = PageQuery.extend({
  from: IsoDate.optional(),
  to: IsoDate.optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
}).refine((q) => !q.from || !q.to || q.from <= q.to, { message: "from must not be after to", path: ["from"] });

export const WalletChange = z
  .object({ balance_before: Money, balance_after: Money, audit_log: AuditEntry })
  .openapi("WalletChange");

export const TopUpBody = z.object({
  amount: z
    .union([z.number(), z.string()])
    .transform(String)
    .pipe(z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "Amount must be a rupee amount below 10 crore with at most two decimals"))
    .refine((value) => Number(value) > 0, "Amount must be positive")
    .openapi({ type: "number", example: 5000 }),
});

export type AuditEntry = z.infer<typeof AuditEntry>;
export type AuditTrail = z.infer<typeof AuditTrail>;
export type AuditQuery = z.infer<typeof AuditQuery>;
export type WalletChange = z.infer<typeof WalletChange>;
