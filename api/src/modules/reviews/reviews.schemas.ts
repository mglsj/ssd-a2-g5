import { z } from "@hono/zod-openapi";
import { PageQuery, Timestamp, Uuid } from "../../shared/schemas.ts";

const Rounded = z.number().nullable();

export const ReviewAnalytics = z
  .object({
    overall_summary: z.object({
      total_reviews: z.number().int(),
      overall_avg_rating: Rounded,
      min_rating: Rounded,
      max_rating: Rounded,
      sub_category_averages: z.object({ cleanliness: Rounded, location: Rounded, communication: Rounded }),
    }),
    rating_distributions: z.array(z.object({ rating: z.number().int(), count: z.number().int(), percentage: z.number() })),
    most_frequent_tags: z.array(z.object({ tag: z.string(), frequency: z.number().int(), avg_rating: z.number() })),
  })
  .openapi("ReviewAnalytics");

export const ReviewAnalyticsQuery = z.object({ property_id: Uuid.optional() });

export const Review = z
  .object({
    id: z.string(),
    property_id: Uuid,
    guest_id: Uuid,
    booking_id: z.string().optional(),
    rating: z.number(),
    sub_ratings: z.record(z.string(), z.number()).optional(),
    location_tags: z.array(z.string()),
    review_text: z.string(),
    created_at: Timestamp,
  })
  .openapi("Review");

export const ReviewListQuery = PageQuery.extend({
  property_id: Uuid.optional(),
  tag: z.string().min(1).max(100).optional().openapi({ description: "Only reviews with this location tag" }),
  rating: z.coerce
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .openapi({ description: "Star bucket, matching the facet's rounding down" }),
});

export type ReviewAnalytics = z.infer<typeof ReviewAnalytics>;
export type Review = z.infer<typeof Review>;
export type ReviewListQuery = z.infer<typeof ReviewListQuery>;
