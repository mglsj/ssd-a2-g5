import { money, sql } from "../../db/postgres.ts";
import { offset } from "../../shared/schemas.ts";
import type { AuditEntry, AuditQuery, AuditTrail, WalletChange } from "./wallet.schemas.ts";

const auditColumns = () => sql`id, action_type, amount_changed::text, balance_after::text, timestamp`;
const signedAmount = () => sql`CASE WHEN action_type = 'DEBIT' THEN -amount_changed ELSE amount_changed END`;
const utcStart = (day: string | null) => sql`${day}::date::timestamp AT TIME ZONE 'UTC'`;
const utcEnd = (day: string | null) => sql`(${day}::date + 1)::timestamp AT TIME ZONE 'UTC'`;

export async function findAuditEntry(id: string): Promise<AuditEntry> {
  const [entry] = await sql`SELECT ${auditColumns()} FROM wallet_audit_logs WHERE id = ${id}`;
  return entry;
}

export async function findLatestAuditEntry(guestId: string): Promise<AuditEntry | null> {
  const [entry] = await sql`
    SELECT ${auditColumns()} FROM wallet_audit_logs
    WHERE guest_id = ${guestId}
    ORDER BY timestamp DESC, id DESC LIMIT 1
  `;
  return entry ?? null;
}

export async function topUp(guestId: string, amount: string): Promise<WalletChange> {
  const [result] = await sql`CALL sp_top_up_wallet(${guestId}::uuid, ${amount}::numeric, NULL, NULL, NULL)`;
  return {
    balance_before: money(result.balance_before),
    balance_after: money(result.balance_after),
    audit_log: await findAuditEntry(result.audit_log_id),
  };
}

/** Returns null when the guest does not exist. */
export async function findAuditTrail(guestId: string, query: AuditQuery): Promise<AuditTrail | null> {
  const from = query.from ?? null;
  const to = query.to ?? null;
  const inRange = () => sql`
    guest_id = ${guestId}
    AND (${from}::date IS NULL OR timestamp >= ${utcStart(from)})
    AND (${to}::date IS NULL OR timestamp < ${utcEnd(to)})
  `;
  const direction = query.order === "asc" ? sql`ASC` : sql`DESC`;

  const [[balances], [count], items] = await Promise.all([
    sql`
      SELECT
        coalesce(
          (SELECT balance_after FROM wallet_audit_logs
           WHERE guest_id = g.id AND timestamp < ${utcStart(from)}
           ORDER BY timestamp DESC, id DESC LIMIT 1),
          (SELECT balance_after - ${signedAmount()}
           FROM wallet_audit_logs WHERE guest_id = g.id
           ORDER BY timestamp, id LIMIT 1),
          g.wallet_balance
        )::text AS opening_balance,
        (SELECT balance_after FROM wallet_audit_logs
         WHERE guest_id = g.id AND (${to}::date IS NULL OR timestamp < ${utcEnd(to)})
         ORDER BY timestamp DESC, id DESC LIMIT 1)::text AS closing_balance
      FROM guests g WHERE g.id = ${guestId}
    `,
    sql`SELECT count(*)::int AS total FROM wallet_audit_logs WHERE ${inRange()}`,
    sql`
      SELECT ${auditColumns()}, (${signedAmount()})::text AS signed_amount
      FROM wallet_audit_logs
      WHERE ${inRange()}
      ORDER BY timestamp ${direction}, id ${direction}
      LIMIT ${query.limit} OFFSET ${offset(query)}
    `,
  ]);
  if (!balances) return null;
  return {
    items,
    opening_balance: balances.opening_balance,
    closing_balance: balances.closing_balance ?? balances.opening_balance,
    page: query.page,
    limit: query.limit,
    total: count.total,
  };
}
