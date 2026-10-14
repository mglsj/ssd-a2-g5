import { mongo } from "../../db/mongo.ts";
import { sql } from "../../db/postgres.ts";
import type { Health, Status } from "./health.schemas.ts";

const check = (probe: Promise<unknown>): Promise<Status> =>
  probe.then(
    () => "ok",
    () => "down",
  );

export async function checkDatabases(): Promise<Health> {
  const [postgres, mongoStatus] = await Promise.all([check(sql`SELECT 1`), check(mongo.command({ ping: 1 }))]);
  return { postgres, mongo: mongoStatus };
}
