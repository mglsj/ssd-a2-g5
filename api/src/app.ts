import { existsSync } from "node:fs";
import { join } from "node:path";
import { serveStatic } from "@hono/bun";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { config } from "./config.ts";
import analytics from "./modules/analytics/index.ts";
import bookings from "./modules/bookings/index.ts";
import guests from "./modules/guests/index.ts";
import health from "./modules/health/index.ts";
import map from "./modules/map/index.ts";
import properties from "./modules/properties/index.ts";
import reviews from "./modules/reviews/index.ts";
import wallet from "./modules/wallet/index.ts";
import { notFoundHandler, onError } from "./shared/middleware/error-handler.ts";
import { createRouter } from "./shared/openapi.ts";

const app = createRouter();

if (config.NODE_ENV !== "test") app.use(logger());
app.use("/api/*", cors());

const api = app
  .route("/api/health", health)
  .route("/api/guests", guests)
  .route("/api/guests", wallet)
  .route("/api/properties", properties)
  .route("/api/bookings", bookings)
  .route("/api/analytics", analytics)
  .route("/api/map", map)
  .route("/api/reviews", reviews);

app.doc31("/api/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "StaySpot API",
    version: "1.0.0",
    description: "Thin layer over the Assignment 1 procedures, SQL functions and MongoDB pipelines.",
  },
});
app.get("/api/docs", Scalar({ url: "/api/openapi.json", pageTitle: "StaySpot API" }));

// Serve the built front end when there is one, so a single process runs the whole app.
// Unknown paths outside /api fall back to index.html for client-side routing.
if (existsSync(join(config.WEB_DIST, "index.html"))) {
  const indexHtml = serveStatic({ root: config.WEB_DIST, path: "index.html" });
  app.get("*", serveStatic({ root: config.WEB_DIST }));
  app.get("*", (c, next) => (c.req.path.startsWith("/api/") ? next() : indexHtml(c, next)));
} else {
  app.get("/", (c) => c.redirect("/api/docs"));
}

app.notFound(notFoundHandler);
app.onError(onError);

export type AppType = typeof api;
export default app;
