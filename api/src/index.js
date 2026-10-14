import "dotenv/config";

import { Hono } from "hono";
import { serve } from "@hono/node-server";

import health from "./routes/health.js";
import guests from "./routes/guests.js";
import properties from "./routes/properties.js";
import bookings from "./routes/bookings.js";
import analytics from "./routes/analytics.js";
import hotspots from "./routes/hotspots.js";
import searchSessions from "./routes/searchSessions.js";
import reviews from "./routes/reviews.js";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    message: "StaySpot API",
    status: "running"
  });
});

app.route("/api/health", health);
app.route("/api/guests", guests);
app.route("/api/properties", properties);
app.route("/api/bookings", bookings);
app.route("/api/analytics", analytics);
app.route("/api/hotspots", hotspots);
app.route("/api/search-sessions", searchSessions);
app.route("/api/reviews", reviews);

const port = Number(process.env.PORT || 3000);

console.log(`API running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port
});