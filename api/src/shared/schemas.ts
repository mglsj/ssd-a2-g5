import { z } from "@hono/zod-openapi";

export const Uuid = z.uuid().openapi({ example: "5c19c2ee-f0a7-43a5-9da4-168131da3fd1" });

export const Money = z
  .string()
  .regex(/^-?\d+\.\d{2}$/)
  .openapi({ description: "Rupee amount with two decimals", example: "4200.00" });

export const IsoDate = z.iso.date().openapi({ example: "2026-10-14" });

export const Timestamp = z.iso.datetime().openapi({ example: "2026-10-14T05:43:51.789Z" });

export const IdParam = z.object({
  id: Uuid.openapi({ param: { name: "id", in: "path" } }),
});

export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
});

export type Page = z.infer<typeof PageQuery>;

export const offset = ({ page, limit }: Page) => (page - 1) * limit;

export function paged<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
  });
}

export type Paged<T> = { items: T[]; page: number; limit: number; total: number };

export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.enum([
        "BAD_REQUEST",
        "NOT_FOUND",
        "INVALID_INPUT",
        "INVALID_TRANSITION",
        "INSUFFICIENT_BALANCE",
        "ALREADY_CHECKED_IN",
        "DB_UNAVAILABLE",
        "INTERNAL",
      ]),
      message: z.string(),
      detail: z.record(z.string(), z.unknown()),
    }),
  })
  .openapi("Error");
