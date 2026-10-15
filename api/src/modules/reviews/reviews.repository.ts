import type { Document, Filter } from "mongodb";
import { propertyReviews } from "../../db/mongo.ts";
import { buildReviewAnalyticsPipeline } from "../../db/pipelines.ts";
import { offset, type Paged } from "../../shared/schemas.ts";
import { sql } from "../../db/postgres.ts";
import { ApiError } from "../../shared/errors/api-error.ts";
import type {
  CreateReviewBody,
  Eligibility,
  EligibilityQuery,
  Review,
  ReviewAnalytics,
  ReviewListQuery,
} from "./reviews.schemas.ts";

/** Workflow 4. $facet always yields exactly one document, even with no matches. */
export async function findReviewAnalytics(propertyId?: string): Promise<ReviewAnalytics> {
  const [result] = await propertyReviews
    .aggregate<ReviewAnalytics>(buildReviewAnalyticsPipeline(propertyId ? { property_id: propertyId } : {}))
    .toArray();
  return result!;
}

export async function listReviews(query: ReviewListQuery): Promise<Paged<Review>> {
  const filter: Filter<Document> = {};
  if (query.property_id) filter.property_id = query.property_id;
  if (query.tag) filter.location_tags = query.tag;
  if (query.rating !== undefined) filter.rating = { $gte: query.rating, $lt: query.rating + 1 };
  const [total, documents] = await Promise.all([
    propertyReviews.countDocuments(filter),
    propertyReviews.find(filter).sort({ created_at: -1, _id: -1 }).skip(offset(query)).limit(query.limit).toArray(),
  ]);
  const items = documents.map(({ _id, ...review }) => ({ id: _id.toHexString(), ...review }) as Review);
  return { items, page: query.page, limit: query.limit, total };
}

/** The guest's oldest COMPLETED stay at the property that has no review yet. */
export async function checkEligibility({ guest_id, property_id }: EligibilityQuery): Promise<Eligibility> {
  const stays = await sql`
    SELECT id FROM bookings
    WHERE guest_id = ${guest_id} AND property_id = ${property_id} AND status = 'COMPLETED'
    ORDER BY created_at, id
  `;
  if (stays.length === 0) return { eligible: false, booking_id: null, reason: "NO_COMPLETED_STAY" };
  const ids = stays.map((stay: { id: string }) => stay.id);
  const reviewed = new Set(
    (await propertyReviews.find({ booking_id: { $in: ids } }, { projection: { booking_id: 1 } }).toArray()).map(
      (review) => review.booking_id as string,
    ),
  );
  const open = ids.find((id: string) => !reviewed.has(id));
  return open
    ? { eligible: true, booking_id: open, reason: "ELIGIBLE" }
    : { eligible: false, booking_id: null, reason: "ALREADY_REVIEWED" };
}

export async function createReview(body: CreateReviewBody): Promise<Review> {
  const check = await checkEligibility(body);
  if (!check.eligible) {
    throw check.reason === "ALREADY_REVIEWED"
      ? new ApiError(409, "ALREADY_REVIEWED", "Every completed stay at this property already has a review")
      : new ApiError(403, "NO_COMPLETED_STAY", "A review needs a completed stay at this property");
  }
  const document = {
    property_id: body.property_id,
    guest_id: body.guest_id,
    booking_id: check.booking_id!,
    rating: body.rating,
    ...(body.sub_ratings && Object.keys(body.sub_ratings).length > 0 && { sub_ratings: body.sub_ratings }),
    location_tags: body.location_tags,
    review_text: body.review_text,
    created_at: new Date(),
  };
  const result = await propertyReviews.insertOne({ ...document });
  return { id: result.insertedId.toHexString(), ...document, created_at: document.created_at.toISOString() } as Review;
}
