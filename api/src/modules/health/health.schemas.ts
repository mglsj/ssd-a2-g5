import { z } from "@hono/zod-openapi";

const Status = z.enum(["ok", "down"]);

export const Health = z.object({ postgres: Status, mongo: Status }).openapi("Health");

export type Status = z.infer<typeof Status>;
export type Health = z.infer<typeof Health>;
