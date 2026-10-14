# StaySpot API

A thin server layer between the web front end and the two databases.
It validates input, calls the Assignment 1 procedures, SQL functions and MongoDB pipelines, and turns database errors into readable messages.
The endpoints are listed in [`docs/api_endpoints.md`](../docs/api_endpoints.md).

## Stack

- [Bun](https://bun.sh) runs the server and the tests. `src/index.ts` exports the app for `Bun.serve`, and [`@hono/bun`](https://www.npmjs.com/package/@hono/bun) serves the built front end.
- [Hono](https://hono.dev) with [`@hono/zod-openapi`](https://github.com/honojs/middleware/tree/main/packages/zod-openapi). Each route declares its input and output with Zod. The same schemas validate requests and generate the OpenAPI document.
- `Bun.sql` talks to PostgreSQL. No ORM: the work happens in the procedures and functions in `sql/`.
- Map layers are GeoJSON (RFC 7946), so MapLibre or Mapbox `geojson` sources can load them by URL. See the map section of the endpoint list.
- The official `mongodb` driver (v6, because v7 does not load on Bun 1.3). The Workflow 3 and 4 pipelines come from `mongo/*.js` through `require()`, so the API runs exactly the scripts from Assignment 1.

## Run it

Inside the dev container, with the databases seeded (`bash scripts/setup_db.sh`):

```bash
cd api
bun install
bun run dev
```

The dev container publishes port 3000 to the host, so the browser on your machine reaches the API at http://localhost:3000. If that port is taken on the host, set `API_HOST_PORT` before the container starts. The server binds `0.0.0.0` (`HOST` changes it), which the published port needs.

The API listens on port 3000 (`PORT` changes it) and reads `PG_URI`, `MONGO_URI` and optionally `MONGO_DB` from the environment. Outside the container, put them in `api/.env`, which Bun loads by itself.

If `web/dist/index.html` exists, the same process serves the front end at http://localhost:3000, with `index.html` as the fallback for client-side routes. `WEB_DIST` points it at another build folder. Without a build, `/` redirects to the API docs.

- Interactive docs: http://localhost:3000/api/docs
- OpenAPI document: http://localhost:3000/api/openapi.json

## Call it from the front end

`src/client.ts` wraps Hono's `hc` with the app's route types, so `web/` gets typed paths, query parameters, bodies and responses without generating code:

```ts
import { createClient } from "../../api/src/client.ts";

const api = createClient(window.location.origin);
const res = await api.api.guests.$get({ query: { sort: "balance_asc", limit: "5" } });
if (res.ok) {
  const page = await res.json(); // typed as { items: Guest[]; page; limit; total }
}
```

`web/` needs `hono` as a dependency for `hc`. Query values are strings, as in a URL.

## Check it

```bash
bun run typecheck
bun test
```

The tests call the app in process against the seeded databases. They cover a booking that succeeds, one that fails for lack of balance, the second check-in blocked by `idx_active_stay`, top-ups, the audit trail adding up, the demo filters, the analytics defaults, every map layer as GeoJSON (including polling for new pins), the review tag filter and the typed client.
They add a few bookings, top-ups and search pins, which stay in the append-only audit log. Run `bash scripts/setup_db.sh` to start fresh.

## Layout

The code is grouped by feature. Each folder in `src/modules/` owns one part of the API:

```
src/
  index.ts              Bun entry point
  app.ts                Mounts the feature routers, docs, CORS, logging and error handling
  config.ts             Reads and checks the environment with Zod
  client.ts             Typed client for web/, built on Hono's hc
  db/                   Bun.sql client, MongoDB client, pipeline builders from mongo/
  modules/
    guests/             Browse guests
    wallet/             Top-ups and the audit trail (under /api/guests/:id)
    properties/         Browse properties and their amenities catalog
    bookings/           Workflow 1 and status changes
    analytics/          Workflow 2 and the materialized view
    map/                Workflow 3 and every GeoJSON layer: hotspots, pins, properties, search area
    reviews/            Workflow 4 and review browsing
    health/             Database health check
  shared/
    schemas.ts          Uuid, Money, dates, pagination, the error body
    openapi.ts          Router factory, response helpers, the Handler type
    geojson.ts          GeoJSON models, feature helpers, the search-area circle
    errors/             ApiError and the database error mapping
    middleware/         Error, not-found and validation handlers
test/                   One bun test file per feature, plus helpers.ts
```

Every module has the same five files:

| File | Holds |
|---|---|
| `<feature>.schemas.ts` | Zod models for requests and responses, and their TypeScript types |
| `<feature>.repository.ts` | The SQL and Mongo calls. Returns typed data, or `null` when a record is missing |
| `<feature>.routes.ts` | `createRoute()` definitions: path, inputs, responses. This is the OpenAPI contract |
| `<feature>.handlers.ts` | Reads the validated input, calls the repository, turns `null` into `404` |
| `index.ts` | Wires routes to handlers and exports the router |

Modules may import each other's schemas and repositories. Bookings and guests reuse `wallet` for audit rows.
