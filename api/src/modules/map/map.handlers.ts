import { circle, toFeature } from "../../shared/geojson.ts";
import { GEOJSON, type Handler } from "../../shared/openapi.ts";
import * as map from "./map.repository.ts";
import type * as routes from "./map.routes.ts";
import type { SearchWindowQuery } from "./map.schemas.ts";

const geoJsonHeaders = { "Content-Type": GEOJSON };

const searchWindow = (query: SearchWindowQuery) => ({
  center: { lat: query.lat, lng: query.lng },
  radius_meters: query.radius,
  generated_at: new Date().toISOString(),
});

export const hotspots: Handler<typeof routes.hotspots> = async (c) => {
  const query = c.req.valid("query");
  const features = await map.findHotspots(query);
  return c.json({ type: "FeatureCollection" as const, features, ...searchWindow(query) }, 200, geoJsonHeaders);
};

export const density: Handler<typeof routes.density> = async (c) => {
  const query = c.req.valid("query");
  return c.json({ ...searchWindow(query), items: await map.findDensityRings(query) }, 200);
};

export const pins: Handler<typeof routes.pins> = async (c) => {
  const query = c.req.valid("query");
  const { features, cursor } = await map.findPins(query);
  return c.json({ type: "FeatureCollection" as const, features, ...searchWindow(query), cursor }, 200, geoJsonHeaders);
};

export const dropPin: Handler<typeof routes.dropPin> = async (c) =>
  c.json(await map.dropPin(c.req.valid("json")), 201, geoJsonHeaders);

export const properties: Handler<typeof routes.properties> = async (c) => {
  const features = await map.findPropertyFeatures(c.req.valid("query"));
  return c.json({ type: "FeatureCollection" as const, features }, 200, geoJsonHeaders);
};

export const area: Handler<typeof routes.area> = async (c) => {
  const { lat, lng, radius } = c.req.valid("query");
  const polygon = circle(lng, lat, radius);
  return c.json(
    toFeature("search-area", polygon, { center_lat: lat, center_lng: lng, radius_meters: radius }),
    200,
    geoJsonHeaders,
  );
};
