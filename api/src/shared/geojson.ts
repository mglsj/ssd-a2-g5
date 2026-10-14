// RFC 7946 GeoJSON, the format MapLibre and Mapbox `geojson` sources load from a URL.
// Positions are [longitude, latitude]. Feature properties stay flat so style
// expressions like ["get", "search_volume"] can read them.
import { z } from "@hono/zod-openapi";

export const Position = z.tuple([z.number(), z.number()]).openapi({ description: "[longitude, latitude]" });

export const PointGeometry = z.object({ type: z.literal("Point"), coordinates: Position }).openapi("PointGeometry");

export const PolygonGeometry = z
  .object({ type: z.literal("Polygon"), coordinates: z.array(z.array(Position)) })
  .openapi("PolygonGeometry");

export function feature<G extends z.ZodType, P extends z.ZodType>(geometry: G, properties: P) {
  return z.object({
    type: z.literal("Feature"),
    id: z.union([z.string(), z.number()]),
    geometry,
    properties,
  });
}

export function featureCollection<F extends z.ZodType>(item: F) {
  return z.object({ type: z.literal("FeatureCollection"), features: z.array(item) });
}

export type Point = z.infer<typeof PointGeometry>;
export type Polygon = z.infer<typeof PolygonGeometry>;
export type Feature<G, P> = { type: "Feature"; id: string | number; geometry: G; properties: P };

export const point = (lng: number, lat: number): Point => ({ type: "Point", coordinates: [lng, lat] });

export const toFeature = <G, P>(id: string | number, geometry: G, properties: P): Feature<G, P> => ({
  type: "Feature",
  id,
  geometry,
  properties,
});

const EARTH_RADIUS_M = 6_371_008.8;

/** A circle as a closed, counter-clockwise polygon ring, for drawing a search radius as a fill layer. */
export function circle(lng: number, lat: number, radiusMeters: number, steps = 64): Polygon {
  const toRad = Math.PI / 180;
  const angular = radiusMeters / EARTH_RADIUS_M;
  const lat1 = lat * toRad;
  const lng1 = lng * toRad;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (-2 * Math.PI * (i % steps)) / steps;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
      );
    ring.push([Number((lng2 / toRad).toFixed(6)), Number((lat2 / toRad).toFixed(6))]);
  }
  return { type: "Polygon", coordinates: [ring] };
}
