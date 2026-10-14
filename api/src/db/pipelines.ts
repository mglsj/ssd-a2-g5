import { createRequire } from "node:module";
import type { Document, Filter } from "mongodb";

// The Assignment 1 workflow scripts export their pipeline builders when loaded
// with require(), so the API runs exactly the pipelines in mongo/.
const require = createRequire(import.meta.url);

type GeoOptions = {
  lng: number;
  lat: number;
  radiusMeters?: number;
  sinceMinutes?: number;
  now?: Date;
};

const workflow3 = require("../../../mongo/02_workflow3_geonear.js") as {
  buildHotspotPipeline(options: GeoOptions & { sortBy?: "distance" | "volume" }): Document[];
  buildRadialDensityPipeline(options: GeoOptions): Document[];
};

const workflow4 = require("../../../mongo/03_workflow4_facet.js") as {
  buildReviewAnalyticsPipeline(filter?: Filter<Document>): Document[];
};

export const { buildHotspotPipeline, buildRadialDensityPipeline } = workflow3;
export const { buildReviewAnalyticsPipeline } = workflow4;
