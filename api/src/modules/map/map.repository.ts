import type { Document } from "mongodb";
import { searchSessions } from "../../db/mongo.ts";
import { buildHotspotPipeline, buildRadialDensityPipeline } from "../../db/pipelines.ts";
import { type Feature, type Point, point, toFeature } from "../../shared/geojson.ts";
import { listAllProperties } from "../properties/properties.repository.ts";
import type { PropertyFilter } from "../properties/properties.schemas.ts";
import type {
  DropPinBody,
  HotspotProperties,
  HotspotQuery,
  PinProperties,
  PinQuery,
  PropertyFeatureProperties,
  Ring,
  SearchWindowQuery,
} from "./map.schemas.ts";

const windowOptions = (query: SearchWindowQuery) => ({
  lat: query.lat,
  lng: query.lng,
  radiusMeters: query.radius,
  sinceMinutes: query.since,
});

type HotspotDocument = Omit<HotspotProperties, "rank" | "latest_search_at"> & {
  hotspot_cluster: Point;
  grid_coordinates: unknown;
  latest_search_at: Date;
};

/** Workflow 3, with each grid cell as a GeoJSON point. */
export async function findHotspots(query: HotspotQuery): Promise<Feature<Point, HotspotProperties>[]> {
  const cells = await searchSessions
    .aggregate<HotspotDocument>(buildHotspotPipeline({ ...windowOptions(query), sortBy: query.sort }))
    .toArray();
  return cells.map(({ hotspot_cluster, grid_coordinates, latest_search_at, ...cell }, index) =>
    toFeature(index + 1, hotspot_cluster, {
      rank: index + 1,
      ...cell,
      latest_search_at: latest_search_at.toISOString(),
    }),
  );
}

export const findDensityRings = (query: SearchWindowQuery) =>
  searchSessions.aggregate<Ring>(buildRadialDensityPipeline(windowOptions(query))).toArray();

type PinDocument = {
  _id: { toHexString(): string };
  session_id: string;
  user_id: string;
  location: Point;
  created_at: Date;
  distance_meters?: number;
};

const pinFeature = (pin: PinDocument): Feature<Point, PinProperties> => {
  const id = pin._id.toHexString();
  return toFeature(id, pin.location, {
    id,
    session_id: pin.session_id,
    user_id: pin.user_id,
    created_at: pin.created_at.toISOString(),
    distance_meters: pin.distance_meters === undefined ? null : Math.round(pin.distance_meters * 10) / 10,
  });
};

/** Raw pins inside the search window, nearest first. Uses the same 2dsphere and created_at index as Workflow 3. */
export async function findPins(query: PinQuery): Promise<{ features: Feature<Point, PinProperties>[]; cursor: string | null }> {
  const createdAt: Document = { $gte: new Date(Date.now() - query.since * 60_000) };
  if (query.after) createdAt.$gt = new Date(query.after);
  const pins = await searchSessions
    .aggregate<PinDocument>([
      {
        $geoNear: {
          near: point(query.lng, query.lat),
          distanceField: "distance_meters",
          maxDistance: query.radius,
          spherical: true,
          query: { created_at: createdAt },
        },
      },
      { $limit: query.limit },
    ])
    .toArray();
  const newest = pins.reduce<Date | null>((max, pin) => (!max || pin.created_at > max ? pin.created_at : max), null);
  const after = query.after ? new Date(query.after).toISOString() : null;
  return { features: pins.map(pinFeature), cursor: newest?.toISOString() ?? after };
}

export async function dropPin(body: DropPinBody): Promise<Feature<Point, PinProperties>> {
  const document = {
    session_id: crypto.randomUUID(),
    user_id: body.user_id,
    location: point(body.lng, body.lat),
    created_at: new Date(),
  };
  const result = await searchSessions.insertOne({ ...document });
  return pinFeature({ _id: result.insertedId, ...document });
}

export async function findPropertyFeatures(filter: PropertyFilter): Promise<Feature<Point, PropertyFeatureProperties>[]> {
  const rows = await listAllProperties(filter);
  return rows.map((row) =>
    toFeature(row.id, point(row.longitude, row.latitude), {
      id: row.id,
      title: row.title,
      base_price: row.base_price,
      distance_meters: row.distance_meters,
    }),
  );
}
