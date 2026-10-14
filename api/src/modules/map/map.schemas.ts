import { z } from "@hono/zod-openapi";
import { feature, featureCollection, PointGeometry, PolygonGeometry } from "../../shared/geojson.ts";
import { Money, Timestamp, Uuid } from "../../shared/schemas.ts";
import { filterRules, PropertyFilter } from "../properties/properties.schemas.ts";

export const IIIT_HYDERABAD = { lat: 17.4455, lng: 78.3489 };

const Latitude = z.coerce.number().min(-90).max(90);
const Longitude = z.coerce.number().min(-180).max(180);

/** The Workflow 3 search window: a centre, a radius of at most 5 km and the 2-hour TTL. */
export const SearchWindowQuery = z.object({
  lat: Latitude.default(IIIT_HYDERABAD.lat).openapi({ description: "Centre latitude, default IIIT Hyderabad" }),
  lng: Longitude.default(IIIT_HYDERABAD.lng).openapi({ description: "Centre longitude, default IIIT Hyderabad" }),
  radius: z.coerce.number().positive().max(5000).default(5000).openapi({ description: "Metres" }),
  since: z.coerce
    .number()
    .positive()
    .max(120)
    .default(120)
    .openapi({ description: "Minutes. Pins expire after 120 through the TTL index" }),
});

const Center = z.object({ lat: z.number(), lng: z.number() });

const searchWindow = {
  center: Center,
  radius_meters: z.number(),
  generated_at: Timestamp,
};

export const HotspotQuery = SearchWindowQuery.extend({ sort: z.enum(["distance", "volume"]).default("distance") });

export const HotspotProperties = z.object({
  rank: z.number().int().openapi({ description: "Position in the sorted list, from 1. Also the feature id" }),
  search_volume: z.number().int(),
  unique_users_count: z.number().int(),
  avg_distance_meters: z.number(),
  avg_distance_km: z.number(),
  min_distance_meters: z.number(),
  max_distance_meters: z.number(),
  latest_search_at: Timestamp,
  hotspot_status: z.enum(["CRITICAL_SURGE", "HIGH_DEMAND", "MODERATE_DEMAND", "LOW_ACTIVITY"]),
});

export const Hotspots = featureCollection(feature(PointGeometry, HotspotProperties))
  .extend(searchWindow)
  .openapi("Hotspots", { description: "GeoJSON FeatureCollection with the search window as foreign members" });

export const Ring = z
  .object({
    ring_start_km: z.number(),
    ring_end_km: z.number(),
    pin_drops_count: z.number().int(),
    unique_searchers: z.number().int(),
    avg_distance_m: z.number(),
  })
  .openapi("DensityRing");

export const DensityRings = z.object({ ...searchWindow, items: z.array(Ring) }).openapi("DensityRings");

export const PinQuery = SearchWindowQuery.extend({
  after: z.iso
    .datetime({ offset: true })
    .optional()
    .openapi({ description: "Only pins created after this time. Pass the previous response's `cursor` to poll" }),
  limit: z.coerce.number().int().min(1).max(5000).default(1000).openapi({ description: "Nearest pins kept" }),
});

export const PinProperties = z.object({
  id: z.string(),
  session_id: z.uuid(),
  user_id: z.string(),
  created_at: Timestamp,
  distance_meters: z.number().nullable(),
});

export const PinFeature = feature(PointGeometry, PinProperties).openapi("SearchPin");

export const Pins = featureCollection(PinFeature)
  .extend({
    ...searchWindow,
    cursor: Timestamp.nullable().openapi({ description: "Newest `created_at` returned, or `after` when nothing is new" }),
  })
  .openapi("SearchPins", { description: "GeoJSON FeatureCollection of pins, nearest first" });

export const DropPinBody = z.object({
  lat: z.number().min(-90).max(90).openapi({ example: 17.4455 }),
  lng: z.number().min(-180).max(180).openapi({ example: 78.3489 }),
  user_id: z.string().min(1).max(100).default("anonymous").openapi({ description: "Usually the selected guest id" }),
});

export const PropertyLayerQuery = filterRules(PropertyFilter);

export const PropertyFeatureProperties = z.object({
  id: Uuid,
  title: z.string(),
  base_price: Money.openapi({ description: 'Use ["to-number", ["get", "base_price"]] in style expressions' }),
  distance_meters: z.number().nullable(),
});

export const PropertyLayer = featureCollection(feature(PointGeometry, PropertyFeatureProperties)).openapi(
  "PropertyLayer",
  { description: "GeoJSON FeatureCollection of properties, nearest first when there is a centre" },
);

export const AreaQuery = z.object({
  lat: Latitude.default(IIIT_HYDERABAD.lat),
  lng: Longitude.default(IIIT_HYDERABAD.lng),
  radius: z.coerce.number().positive().max(50_000).default(5000).openapi({ description: "Metres" }),
});

export const Area = feature(
  PolygonGeometry,
  z.object({ center_lat: z.number(), center_lng: z.number(), radius_meters: z.number() }),
).openapi("SearchArea", { description: "The search radius as a 64-sided polygon, for a fill or line layer" });

export type SearchWindowQuery = z.infer<typeof SearchWindowQuery>;
export type HotspotQuery = z.infer<typeof HotspotQuery>;
export type HotspotProperties = z.infer<typeof HotspotProperties>;
export type Ring = z.infer<typeof Ring>;
export type PinQuery = z.infer<typeof PinQuery>;
export type PinProperties = z.infer<typeof PinProperties>;
export type DropPinBody = z.infer<typeof DropPinBody>;
export type PropertyFeatureProperties = z.infer<typeof PropertyFeatureProperties>;
