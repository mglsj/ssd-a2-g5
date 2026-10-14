import app from "./app.ts";
import { config } from "./config.ts";

console.log(`StaySpot API on http://localhost:${config.PORT} (docs at /api/docs)`);

// Bind every interface so the port published by the dev container reaches the server.
export default { hostname: config.HOST, port: config.PORT, fetch: app.fetch };
