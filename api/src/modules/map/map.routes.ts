import { createRoute } from "@hono/zod-openapi";
import { errors, geoJson, json, jsonBody } from "../../shared/openapi.ts";
import {
  Area,
  AreaQuery,
  DensityRings,
  DropPinBody,
  HeatCells,
  HeatQuery,
  HotspotQuery,
  Hotspots,
  PinFeature,
  PinQuery,
  Pins,
  PropertyLayer,
  PropertyLayerQuery,
  SearchWindowQuery,
} from "./map.schemas.ts";

const geoJsonNote = "Returns GeoJSON (RFC 7946), so the URL can be the `data` of a MapLibre or Mapbox `geojson` source.";

export const hotspots = createRoute({
  method: "get",
  path: "/hotspots",
  tags: ["Map"],
  summary: "Search hotspots around a point (Workflow 3, $geoNear)",
  description:
    "Runs `buildHotspotPipeline` from `mongo/02_workflow3_geonear.js`. Pins are grouped into grid cells about 1 km wide, and each cell is a point feature. " +
    `The features are the result list, sorted by \`sort\`. ${geoJsonNote}`,
  request: { query: HotspotQuery },
  responses: { 200: geoJson(Hotspots, "Hotspot cells"), ...errors(400) },
});

export const density = createRoute({
  method: "get",
  path: "/density",
  tags: ["Map"],
  summary: "Pin counts in 1 km rings around a point",
  description: "Runs `buildRadialDensityPipeline` from `mongo/02_workflow3_geonear.js`. Chart data, not GeoJSON.",
  request: { query: SearchWindowQuery },
  responses: { 200: json(DensityRings, "Rings, nearest first"), ...errors(400) },
});

export const heat = createRoute({
  method: "get",
  path: "/heat",
  tags: ["Map"],
  summary: "Search pins binned into a grid, for a heatmap layer",
  description:
    "Runs `$geoNear` over every pin in the window, then groups them into square cells `cell` metres wide. " +
    "Each non-empty cell is one point at its pins' centroid, with `count` as the heatmap weight. " +
    geoJsonNote,
  request: { query: HeatQuery },
  responses: { 200: geoJson(HeatCells, "Heat cells"), ...errors(400) },
});

export const pins = createRoute({
  method: "get",
  path: "/pins",
  tags: ["Map"],
  summary: "Individual search pins around a point, nearest first",
  description:
    "Runs `$geoNear` on `SearchSessions` within the same window as the hotspots. " +
    "To poll for new pins, pass the last response's `cursor` as `after` and add the returned features to the source. " +
    geoJsonNote,
  request: { query: PinQuery },
  responses: { 200: geoJson(Pins, "Pins"), ...errors(400) },
});

export const dropPin = createRoute({
  method: "post",
  path: "/pins",
  tags: ["Map"],
  summary: "Drop a search pin so it shows up on the map",
  description: "Returns the stored pin as a GeoJSON feature, ready to add to a source.",
  request: { body: jsonBody(DropPinBody) },
  responses: { 201: geoJson(PinFeature, "The stored pin"), ...errors(400, 422) },
});

export const properties = createRoute({
  method: "get",
  path: "/properties",
  tags: ["Map"],
  summary: "Properties as a map layer",
  description:
    "Takes the same filters as `GET /api/properties` without pagination. Without `lat` and `lng` it returns every property (about 1,000). " +
    geoJsonNote,
  request: { query: PropertyLayerQuery },
  responses: { 200: geoJson(PropertyLayer, "Property points"), ...errors(400) },
});

export const area = createRoute({
  method: "get",
  path: "/area",
  tags: ["Map"],
  summary: "The search radius as a polygon",
  request: { query: AreaQuery },
  responses: { 200: geoJson(Area, "A circle polygon"), ...errors(400) },
});
