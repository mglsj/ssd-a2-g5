import { z } from "@hono/zod-openapi";
import { Money, PageQuery, Timestamp, Uuid } from "../../shared/schemas.ts";

export const Property = z
  .object({
    id: Uuid,
    title: z.string(),
    base_price: Money,
    latitude: z.number(),
    longitude: z.number(),
  })
  .openapi("Property");

export const PropertyDetail = Property.extend({
  summary: z.object({
    completed_bookings: z.number().int(),
    total_nights_booked: z.number().int(),
    gross_revenue: Money,
  }),
}).openapi("PropertyDetail");

const RuleOrNote = z.union([z.string(), z.record(z.string(), z.unknown())]);

export const Amenities = z
  .looseObject({
    property_id: Uuid,
    property_title: z.string().optional(),
    amenities: z.array(z.string()),
    house_rules: z.array(RuleOrNote),
    accessibility_features: z.array(RuleOrNote),
    safety_features: z.array(z.string()).optional(),
    host_guidelines: z.record(z.string(), z.unknown()).optional(),
    star_rating: z.number().int().optional(),
    guest_rating: z.number().optional(),
    updated_at: Timestamp.optional(),
  })
  .openapi("PropertyAmenities", { description: "Flexible catalog document. Fields vary between properties." });

export const PropertyListItem = Property.extend({
  distance_meters: z.number().nullable().openapi({ description: "Distance from `lat`/`lng`, null without a centre" }),
}).openapi("PropertyListItem");

const PriceFilter = z.coerce.number().nonnegative().optional();

/** Filters shared by the paged list and the map layer. */
export const PropertyFilter = z.object({
  q: z.string().max(100).default("").openapi({ description: "Case-insensitive title search" }),
  min_price: PriceFilter,
  max_price: PriceFilter,
  lat: z.coerce.number().min(-90).max(90).optional().openapi({ description: "Centre latitude. Needs `lng`" }),
  lng: z.coerce.number().min(-180).max(180).optional().openapi({ description: "Centre longitude. Needs `lat`" }),
  radius: z.coerce
    .number()
    .positive()
    .max(50_000)
    .default(5000)
    .openapi({ description: "Metres around `lat`/`lng`. Ignored without a centre" }),
});

export const filterRules = <S extends z.ZodType<z.infer<typeof PropertyFilter>>>(schema: S): S =>
  schema
    .refine((q) => q.min_price === undefined || q.max_price === undefined || q.min_price <= q.max_price, {
      message: "min_price cannot be greater than max_price",
      path: ["min_price"],
    })
    .refine((q) => (q.lat === undefined) === (q.lng === undefined), {
      message: "lat and lng go together",
      path: ["lat"],
    });

export const PropertyListQuery = filterRules(
  PageQuery.extend(PropertyFilter.shape).extend({
    sort: z
      .enum(["title", "price_asc", "price_desc", "revenue", "distance"])
      .default("title")
      .openapi({ description: "`revenue` uses mv_property_summary. `distance` needs `lat` and `lng`" }),
  }),
).refine((q) => q.sort !== "distance" || q.lat !== undefined, {
  message: "sort=distance needs lat and lng",
  path: ["sort"],
});

export type Property = z.infer<typeof Property>;
export type PropertyListItem = z.infer<typeof PropertyListItem>;
export type PropertyFilter = z.infer<typeof PropertyFilter>;
export type PropertyDetail = z.infer<typeof PropertyDetail>;
export type Amenities = z.infer<typeof Amenities>;
export type PropertyListQuery = z.infer<typeof PropertyListQuery>;
