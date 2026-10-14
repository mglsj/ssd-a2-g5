import { propertyAmenities } from "../../db/mongo.ts";
import { sql } from "../../db/postgres.ts";
import { escapeLike } from "../../shared/like.ts";
import { offset, type Paged } from "../../shared/schemas.ts";
import type {
  Amenities,
  PropertyDetail,
  PropertyFilter,
  PropertyListItem,
  PropertyListQuery,
} from "./properties.schemas.ts";

// Great-circle distance in metres. Properties keep plain latitude and longitude
// columns and there are only about 1,000 of them, so no spatial index is needed.
const distanceFrom = (lat: number, lng: number) => sql`
  (6371008.8 * 2 * asin(sqrt(
    power(sin(radians(p.latitude - ${lat}::float8) / 2), 2)
    + cos(radians(${lat}::float8)) * cos(radians(p.latitude))
      * power(sin(radians(p.longitude - ${lng}::float8) / 2), 2)
  )))
`;

const distanceColumn = (filter: PropertyFilter) =>
  filter.lat !== undefined && filter.lng !== undefined
    ? sql`round(${distanceFrom(filter.lat, filter.lng)}::numeric, 1)::float8`
    : sql`NULL::float8`;

const matches = (filter: PropertyFilter) => {
  const minPrice = filter.min_price ?? null;
  const maxPrice = filter.max_price ?? null;
  const near =
    filter.lat !== undefined && filter.lng !== undefined
      ? sql`AND ${distanceFrom(filter.lat, filter.lng)} <= ${filter.radius}::float8`
      : sql``;
  return sql`
    p.title ILIKE ${`%${escapeLike(filter.q)}%`}
    AND (${minPrice}::numeric IS NULL OR p.base_price >= ${minPrice}::numeric)
    AND (${maxPrice}::numeric IS NULL OR p.base_price <= ${maxPrice}::numeric)
    ${near}
  `;
};

export async function listProperties(query: PropertyListQuery): Promise<Paged<PropertyListItem>> {
  const order = {
    title: sql`p.title, p.id`,
    price_asc: sql`p.base_price, p.id`,
    price_desc: sql`p.base_price DESC, p.id`,
    revenue: sql`m.gross_revenue DESC NULLS LAST, p.id`,
    distance: sql`distance_meters, p.id`,
  }[query.sort];
  const [[count], items] = await Promise.all([
    sql`SELECT count(*)::int AS total FROM properties p WHERE ${matches(query)}`,
    sql`
      SELECT p.id, p.title, p.base_price::text, p.latitude, p.longitude, ${distanceColumn(query)} AS distance_meters
      FROM properties p
      LEFT JOIN mv_property_summary m ON m.property_id = p.id
      WHERE ${matches(query)}
      ORDER BY ${order}
      LIMIT ${query.limit} OFFSET ${offset(query)}
    `,
  ]);
  return { items, page: query.page, limit: query.limit, total: count.total };
}

/** Every matching property, nearest first when there is a centre. For the map layer. */
export async function listAllProperties(filter: PropertyFilter): Promise<PropertyListItem[]> {
  return sql`
    SELECT p.id, p.title, p.base_price::text, p.latitude, p.longitude, ${distanceColumn(filter)} AS distance_meters
    FROM properties p
    WHERE ${matches(filter)}
    ORDER BY distance_meters NULLS LAST, p.title, p.id
  `;
}

export async function findProperty(id: string): Promise<PropertyDetail | null> {
  const [row] = await sql`
    SELECT p.id, p.title, p.base_price::text, p.latitude, p.longitude,
      coalesce(m.completed_bookings, 0)::int AS completed_bookings,
      coalesce(m.total_nights_booked, 0)::int AS total_nights_booked,
      coalesce(m.gross_revenue, 0)::numeric(14,2)::text AS gross_revenue
    FROM properties p
    LEFT JOIN mv_property_summary m ON m.property_id = p.id
    WHERE p.id = ${id}
  `;
  if (!row) return null;
  const { completed_bookings, total_nights_booked, gross_revenue, ...property } = row;
  return { ...property, summary: { completed_bookings, total_nights_booked, gross_revenue } };
}

export const findAmenities = (propertyId: string) =>
  propertyAmenities.findOne<Amenities>({ property_id: propertyId }, { projection: { _id: 0 } });
