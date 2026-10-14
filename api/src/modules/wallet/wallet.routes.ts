import { createRoute } from "@hono/zod-openapi";
import { errors, json, jsonBody } from "../../shared/openapi.ts";
import { IdParam } from "../../shared/schemas.ts";
import { AuditQuery, AuditTrail, TopUpBody, WalletChange } from "./wallet.schemas.ts";

export const topUp = createRoute({
  method: "post",
  path: "/{id}/top-up",
  tags: ["Guests"],
  summary: "Add money to the wallet with sp_top_up_wallet",
  request: { params: IdParam, body: jsonBody(TopUpBody) },
  responses: { 200: json(WalletChange, "The wallet after the top-up"), ...errors(400, 404, 422) },
});

export const auditTrail = createRoute({
  method: "get",
  path: "/{id}/audit",
  tags: ["Guests"],
  summary: "Wallet audit trail with opening and closing balance",
  description:
    "`from` and `to` are UTC days and both are inclusive. `balance_after` on each row is the running balance the trigger recorded.",
  request: { params: IdParam, query: AuditQuery },
  responses: { 200: json(AuditTrail, "A page of audit rows"), ...errors(400, 404) },
});
