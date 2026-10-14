import { resolve } from "node:path";
import { z } from "zod";

const Env = z.object({
  WEB_DIST: z
    .string()
    .default(resolve(import.meta.dir, "../../web/dist"))
    .transform((path) => resolve(path)),
  PG_URI: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// or postgresql:// URL"),
  MONGO_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, "must be a mongodb:// or mongodb+srv:// URL"),
  MONGO_DB: z.string().min(1).default("stayspot"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.string().default("development"),
});

const parsed = Env.safeParse(Bun.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`).join("\n");
  throw new Error(`Invalid environment:\n${problems}`);
}

export const config = parsed.data;
