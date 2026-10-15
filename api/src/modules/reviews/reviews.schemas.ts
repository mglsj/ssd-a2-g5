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

export const REVIEW_TAGS = [
  "it_corridor",
  "walkable",
  "metro_station",
  "restaurants",
  "nightlife",
  "shopping_mall",
  "lake_view",
  "parks",
  "museums",
  "tourist_attractions",
  "quiet_neighborhood",
  "central_location",
  "street_food",
  "cafes",
  "grocery_stores",
  "fitness_center",
  "hospital_nearby",
  "airport_convenient",
  "rock_formations",
  "gated_community",
  "historic_area",
  "temple_nearby",
] as const;

const SubRating = z.number().int().min(1).max(5);

export const CreateReviewBody = z
  .object({
    guest_id: Uuid,
    property_id: Uuid,
    rating: z.number().int().min(1).max(5),
    review_text: z.string().trim().min(3).max(2000),
    location_tags: z.array(z.enum(REVIEW_TAGS)).min(1).max(5),
    sub_ratings: z
      .object({
        cleanliness: SubRating,
        accuracy: SubRating,
        communication: SubRating,
        location: SubRating,
        check_in: SubRating,
        value: SubRating,
      })
      .partial()
      .optional(),
  })
  .openapi("CreateReviewBody");

export const EligibilityQuery = z.object({ guest_id: Uuid, property_id: Uuid });

export const Eligibility = z
  .object({
    eligible: z.boolean(),
    booking_id: Uuid.nullable().openapi({ description: "The completed stay the review would be tied to" }),
    reason: z.enum(["ELIGIBLE", "NO_COMPLETED_STAY", "ALREADY_REVIEWED"]),
  })
  .openapi("ReviewEligibility");

export type CreateReviewBody = z.infer<typeof CreateReviewBody>;
export type Eligibility = z.infer<typeof Eligibility>;
export type EligibilityQuery = z.infer<typeof EligibilityQuery>;
