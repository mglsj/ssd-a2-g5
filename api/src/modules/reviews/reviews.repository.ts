import type { Document, Filter } from "mongodb";
import { propertyReviews } from "../../db/mongo.ts";
import { buildReviewAnalyticsPipeline } from "../../db/pipelines.ts";
import { offset, type Paged } from "../../shared/schemas.ts";
import type { Review, ReviewAnalytics, ReviewListQuery } from "./reviews.schemas.ts";

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
