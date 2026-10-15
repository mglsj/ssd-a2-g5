# API endpoints

The API in `api/` is a thin layer between the web front end and the two databases.
It validates input, calls the Assignment 1 procedures, functions and pipelines, and turns database errors into readable messages.
It does not compute business results itself.

## Conventions

- Base path is `/api`. Requests and responses are JSON, except the map layers, which are GeoJSON (see [Map](#map-workflow-3)).
- `api/src/client.ts` exports `createClient(baseUrl)`, a typed client built on Hono's `hc`. Query, body and response types come from the same Zod schemas, so a wrong parameter is a type error in `web/`.
- When `web/dist/index.html` exists, the API also serves the built front end, and any path outside `/api` falls back to `index.html` for client-side routing. `WEB_DIST` points it at another folder.
- The running API serves this contract as OpenAPI 3.1 at `/api/openapi.json` and as interactive docs at `/api/docs`. Each route declares its input and output with Zod in `api/src/modules/<feature>/<feature>.routes.ts`, so the two cannot drift.
- IDs are UUID strings. The API rejects a malformed UUID with `400` before it reaches the database.
- Money is a string with two decimals (`"1250.00"`), as PostgreSQL returns `DECIMAL`. The front end formats it as rupees.
- Timestamps are ISO 8601 strings in UTC. Dates (`from`, `to`, `as_of`) are `YYYY-MM-DD`.
- There is no authentication. The role and guest switcher in the UI is for the demo only, and the API trusts the `guest_id` it receives. See the README assumptions.

### Pagination

List endpoints take `page` (default 1) and `limit` (default 20, max 100) and return:

```json
{ "items": [], "page": 1, "limit": 20, "total": 50000 }
```

The browser never loads a whole table.

### Errors

Every error has the same shape:

```json
{ "error": { "code": "INSUFFICIENT_BALANCE", "message": "Insufficient balance: the booking costs 9000.00 but the wallet has 1200.00", "detail": {} } }
```

`message` is the text raised by the procedure, so the UI can show it as is. `code` lets the UI pick an icon, a hint or a follow-up action.

| Source | Condition | HTTP | `code` |
|---|---|---|---|
| API validation | Missing or malformed field, bad UUID, bad date, unreadable JSON body. `detail.issues` lists each `{ path, message }` | 400 | `BAD_REQUEST` |
| PostgreSQL `P0002` (`no_data_found`) | Guest, property or booking does not exist | 404 | `NOT_FOUND` |
| PostgreSQL `22023` (`invalid_parameter_value`) from `sp_execute_booking` or `sp_top_up_wallet` | Nights outside 1 to 365, check-in outside today to +365 days, top-up amount not positive | 422 | `INVALID_INPUT` |
| PostgreSQL `22003` (`numeric_value_out_of_range`) | A top-up would push the wallet past 99,999,999.99 | 422 | `INVALID_INPUT` |
| PostgreSQL `22023` from `sp_update_booking_status` | Transition other than CONFIRMED to CHECKED_IN to COMPLETED | 409 | `INVALID_TRANSITION` |
| PostgreSQL `SP001` from `sp_update_booking_status` | Check-in before the booking's check-in date | 409 | `TOO_EARLY_TO_CHECK_IN` |
| PostgreSQL `23514`, constraint `chk_guests_wallet_nonnegative` | Wallet cannot cover the booking | 409 | `INSUFFICIENT_BALANCE` |
| PostgreSQL `23505`, constraint `idx_active_stay` | Guest already has a CHECKED_IN booking | 409 | `ALREADY_CHECKED_IN` |
| Review without a COMPLETED stay at the property | Checked in the API before the insert | 403 | `NO_COMPLETED_STAY` |
| Every COMPLETED stay at the property already has a review | One review per stay | 409 | `ALREADY_REVIEWED` |
| MongoDB error `121` | Document fails the collection validator | 422 | `INVALID_INPUT` |
| Connection failure | A database is down | 503 | `DB_UNAVAILABLE` |
| Anything else | Unexpected error (logged on the server) | 500 | `INTERNAL` |

## Health

### `GET /api/health`

Checks both databases.

```json
{ "postgres": "ok", "mongo": "ok" }
```

Returns `503` if either one fails.

## Guests and wallet

### `GET /api/guests`

| Query | Notes |
|---|---|
| `q` | Case-insensitive name search |
| `page`, `limit` | Pagination |
| `sort` | `name` (default), `balance_desc` or `balance_asc` |
| `has_active_stay` | `true` keeps guests with a CHECKED_IN booking, `false` keeps the rest |

Item: `{ "id", "name", "wallet_balance" }`

For the demo, `sort=balance_asc` finds a guest who cannot afford a booking, and `has_active_stay=true` finds one whose next check-in will hit `idx_active_stay`.

### `GET /api/guests/:id`

```json
{
  "id": "…",
  "name": "Aarav Sharma",
  "wallet_balance": "4200.00",
  "active_booking": { "id": "…", "property_id": "…", "property_title": "…", "status": "CHECKED_IN" },
  "booking_counts": { "CONFIRMED": 2, "CHECKED_IN": 1, "COMPLETED": 7 },
  "latest_audit": { "id": "…", "action_type": "DEBIT", "amount_changed": "3000.00", "balance_after": "4200.00", "timestamp": "…" }
}
```

`active_booking` and `latest_audit` are `null` when there is none. `404` if the guest does not exist.

### `POST /api/guests/:id/top-up`

Calls `sp_top_up_wallet`.

Body: `{ "amount": 5000 }`. `amount` is a number or a numeric string, positive, with at most two decimals.

```json
{
  "balance_before": "1200.00",
  "balance_after": "6200.00",
  "audit_log": { "id": "…", "action_type": "CREDIT", "amount_changed": "5000.00", "balance_after": "6200.00", "timestamp": "…" }
}
```

Errors: `INVALID_INPUT`, `NOT_FOUND`.

### `GET /api/guests/:id/audit`

The wallet audit trail. Uses `idx_wallet_audit_logs_guest_time`.

| Query | Notes |
|---|---|
| `from`, `to` | Optional date range in UTC days, both inclusive. `from` after `to` gives `400` |
| `order` | `desc` (default, newest first) or `asc` |
| `page`, `limit` | Pagination |

```json
{
  "items": [
    { "id": "…", "timestamp": "…", "action_type": "DEBIT", "amount_changed": "3000.00", "signed_amount": "-3000.00", "balance_after": "4200.00" }
  ],
  "opening_balance": "7200.00",
  "closing_balance": "4200.00",
  "page": 1, "limit": 20, "total": 14
}
```

`balance_after` is the running balance, since the trigger records it on every change.
`opening_balance` is the balance just before the range: the `balance_after` of the last row before `from`, or, when there is none, the balance before the guest's first row.
`closing_balance` is the `balance_after` of the last row up to `to`. So `opening_balance` plus every `signed_amount` in the range equals `closing_balance`.

## Properties

### `GET /api/properties`

| Query | Notes |
|---|---|
| `q` | Case-insensitive title search. `%` and `_` match literally |
| `min_price`, `max_price` | Filter on `base_price`. Must be non-negative numbers, and `min_price` cannot exceed `max_price` (`400` otherwise) |
| `lat`, `lng` | Optional centre. Both or neither |
| `radius` | Metres around the centre, default 5000, at most 50,000. Ignored without a centre |
| `sort` | `title` (default), `price_asc`, `price_desc`, `revenue` (from `mv_property_summary`) or `distance` (needs a centre). Ties break on `id`, so pages stay stable |
| `page`, `limit` | Pagination |

Item: `{ "id", "title", "base_price", "latitude", "longitude", "distance_meters" }`. `distance_meters` is the great-circle distance from the centre, or `null` without one.

### `GET /api/properties/:id`

```json
{
  "id": "…",
  "title": "…",
  "base_price": "3000.00",
  "latitude": 17.44,
  "longitude": 78.35,
  "summary": { "completed_bookings": 21, "total_nights_booked": 58, "gross_revenue": "174000.00" }
}
```

`summary` comes from `mv_property_summary`, so it is only as fresh as the last refresh.

### `GET /api/properties/:id/amenities`

The `PropertyAmenities` document for the property without its `_id`: `property_id`, `property_title`, `amenities`, `house_rules`, `accessibility_features`, `safety_features`, `host_guidelines`, `star_rating`, `guest_rating`, `updated_at`.
Fields vary between documents. `404` if the property has no catalog document, which the UI shows as an empty state.

## Bookings (Workflow 1)

### `GET /api/bookings`

| Query | Notes |
|---|---|
| `guest_id` | Filter by guest (guest mode always sets this) |
| `property_id` | Filter by property |
| `status` | `CONFIRMED`, `CHECKED_IN` or `COMPLETED` |
| `page`, `limit` | Pagination, newest first |

Item: `{ "id", "guest_id", "guest_name", "property_id", "property_title", "nights", "check_in_date", "total_cost", "status", "created_at" }`

### `POST /api/bookings`

Books a stay with `CALL sp_execute_booking(guest_id, property_id, nights, check_in_date, NULL, NULL, NULL, NULL, NULL)`.
The procedure locks the guest row, deducts `base_price * nights`, inserts a CONFIRMED booking, and the trigger writes a DEBIT audit row. All of this commits together or not at all.

Body: `{ "guest_id": "…", "property_id": "…", "nights": 3, "check_in_date": "2026-11-02" }`. `check_in_date` is optional. It defaults to today and must fall between today and 365 days ahead (otherwise `INVALID_INPUT`).

`201`:

```json
{
  "booking": { "id": "…", "guest_id": "…", "guest_name": "…", "property_id": "…", "property_title": "…", "nights": 3, "check_in_date": "2026-11-02", "total_cost": "9000.00", "status": "CONFIRMED", "created_at": "…" },
  "balance_before": "13200.00",
  "balance_after": "4200.00",
  "audit_log": { "id": "…", "action_type": "DEBIT", "amount_changed": "9000.00", "balance_after": "4200.00", "timestamp": "…" }
}
```

The API reads `audit_log` by the `audit_log_id` the procedure returns, so the UI can show that the trigger fired.

Errors:

| `code` | When | `detail` |
|---|---|---|
| `INSUFFICIENT_BALANCE` | Wallet is less than the cost | `{ "total_cost", "balance" }` so the UI can offer a top-up of the difference |
| `INVALID_INPUT` | Nights outside 1 to 365 | |
| `NOT_FOUND` | Unknown guest or property | |

A failed booking leaves the wallet, the bookings table and the audit log unchanged.

### `GET /api/bookings/:id`

One booking with guest and property names. `404` if missing.

### `PATCH /api/bookings/:id/status`

Moves a booking forward with `sp_update_booking_status`. This is how the UI demonstrates the partial unique index `idx_active_stay`.

Body: `{ "status": "CHECKED_IN" }`. `status` is `CONFIRMED`, `CHECKED_IN` or `COMPLETED`. The procedure decides which moves are allowed.

```json
{ "booking": { "id": "…", "guest_name": "…", "property_title": "…", "status": "CHECKED_IN", "…": "…" }, "previous_status": "CONFIRMED" }
```

Errors:

| `code` | When | `detail` |
|---|---|---|
| `TOO_EARLY_TO_CHECK_IN` | Check-in before the booking's `check_in_date` | `{ "check_in_date" }` |
| `ALREADY_CHECKED_IN` | The guest already has a CHECKED_IN booking | `{ "active_booking_id" }` so the UI can link to it |
| `INVALID_TRANSITION` | Anything other than CONFIRMED to CHECKED_IN or CHECKED_IN to COMPLETED | `{ "from", "to" }` |
| `NOT_FOUND` | Unknown booking | |

## Analytics (Workflow 2 and the materialized view)

### `GET /api/analytics/moving-average`

Calls `fn_property_moving_avg(from, to, property_id)`: completed booking revenue per day and its 7-day moving average over a gap-free daily grid.

| Query | Notes |
|---|---|
| `property_id` | Optional. Repeat up to 5 times to compare properties. Repeated ids count once. An unknown id gives `404`. Default: the top 5 of `/analytics/rank` on `to` |
| `from`, `to` | UTC days, at most 366 apart. Default `to`: the latest day with a COMPLETED booking. Default `from`: 89 days before `to` |

```json
{
  "from": "2026-06-27",
  "to": "2026-09-24",
  "series": [
    {
      "property_id": "…",
      "title": "…",
      "points": [ { "day": "2026-06-01", "daily_revenue": "0.00", "moving_avg_7d": "1285.71" } ]
    }
  ]
}
```

The chart can load with no parameters and still show data, even when the seed data is weeks old. The API never charts every property: the function returns one row per property per day, which is 90,000 rows for 1,000 properties over 90 days.

### `GET /api/analytics/rank`

Calls `fn_property_revenue_rank(as_of, limit)`: properties ranked by their 7-day moving average with `DENSE_RANK()`.

| Query | Notes |
|---|---|
| `as_of` | Default: the latest UTC day with a COMPLETED booking, so the ranking is not all zeros when the seed data is a few days old |
| `limit` | Highest rank to include, 1 to 100, default 10. Ties share a rank, so more rows than `limit` can come back, up to 100 |

```json
{ "as_of": "2026-09-24", "items": [ { "revenue_rank": 1, "property_id": "…", "title": "…", "moving_avg_7d": "1285.71" } ] }
```

### `GET /api/analytics/summary`

Reads `mv_property_summary` and `mv_refresh_log`.

| Query | Notes |
|---|---|
| `sort` | `gross_revenue` (default), `completed_bookings`, `total_nights_booked`, `title` |
| `page`, `limit` | Pagination |

```json
{
  "refreshed_at": "2026-09-24T08:15:02Z",
  "totals": { "properties": 1000, "completed_bookings": 21000, "total_nights_booked": 61000, "gross_revenue": "182000000.00" },
  "items": [ { "property_id", "title", "completed_bookings", "total_nights_booked", "gross_revenue" } ],
  "page": 1, "limit": 20, "total": 1000
}
```

### `POST /api/analytics/summary/refresh`

Calls `refresh_mv_property_summary()`, which runs `REFRESH MATERIALIZED VIEW CONCURRENTLY` and records the time.

```json
{ "refreshed_at": "2026-09-24T09:40:11Z" }
```

A new COMPLETED booking only shows up in the summary after this call. The demo uses that to show what a materialized view is.

## Map (Workflow 3)

Every map layer is [GeoJSON (RFC 7946)](https://datatracker.ietf.org/doc/html/rfc7946) served as `application/geo+json`, so its URL can be the `data` of a MapLibre or Mapbox `geojson` source:

```js
map.addSource("hotspots", { type: "geojson", data: "/api/map/hotspots?lat=17.4455&lng=78.3489" });
map.addLayer({ id: "hotspots", type: "circle", source: "hotspots",
  paint: { "circle-radius": ["interpolate", ["linear"], ["get", "search_volume"], 1, 4, 30, 20] } });
```

- Coordinates are `[longitude, latitude]`.
- Feature properties are flat, so style expressions read them with `["get", "…"]`.
- Every feature has a top-level `id`. Hotspot ids are numbers, so `setFeatureState` works on them directly. Pins and properties use string ids, so set `promoteId: "id"` on their sources.
- Money stays a string. Use `["to-number", ["get", "base_price"]]` in expressions.
- Hotspots and pins also carry the search window as extra top-level members (`center`, `radius_meters`, `generated_at`). RFC 7946 allows these, and MapLibre ignores them.

The search window is shared by hotspots, pins and density:

| Query | Notes |
|---|---|
| `lat`, `lng` | Centre. Default: IIIT Hyderabad (17.4455, 78.3489) |
| `radius` | Metres, default 5000, at most 5000 |
| `since` | Minutes, default 120, at most 120 (the TTL window) |

### `GET /api/map/hotspots`

Runs `buildHotspotPipeline` from `mongo/02_workflow3_geonear.js` on `SearchSessions`. `$geoNear` finds pins within the window, then groups them into grid cells about 1 km wide. Each cell is a point feature, and the features are the result list in order.

Extra query: `sort`, either `distance` (default, by average distance) or `volume`.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": 1,
      "geometry": { "type": "Point", "coordinates": [78.35, 17.45] },
      "properties": {
        "rank": 1, "search_volume": 34, "unique_users_count": 31,
        "avg_distance_meters": 840.2, "avg_distance_km": 0.84,
        "min_distance_meters": 120.4, "max_distance_meters": 1480.2,
        "latest_search_at": "…", "hotspot_status": "CRITICAL_SURGE"
      }
    }
  ],
  "center": { "lat": 17.4455, "lng": 78.3489 },
  "radius_meters": 5000,
  "generated_at": "…"
}
```

`features` is empty when no pins are recent, for example two hours after seeding without `--live`.

### `GET /api/map/pins`

Individual search pins in the window, nearest first. Uses `$geoNear` on the same compound 2dsphere and `created_at` index as the hotspots.

| Extra query | Notes |
|---|---|
| `after` | ISO timestamp. Only pins created after it |
| `limit` | Nearest pins kept, default 1000, at most 5000 |

Each feature's properties are `{ "id", "session_id", "user_id", "created_at", "distance_meters" }`. The collection also has `cursor`: the newest `created_at` returned, or `after` when nothing is new.

To make new pings appear without a reload, load the layer once, then every few seconds call it again with `after=<cursor>` and add the returned features to the source's data.

### `POST /api/map/pins`

Drops one search pin, so a new ping can appear during the demo.

Body: `{ "lat": 17.44, "lng": 78.35, "user_id": "…" }`. `user_id` is optional, usually the selected guest, and defaults to `"anonymous"`.

`201` returns the stored pin as a feature in the same shape as `GET /api/map/pins`, with `distance_meters: null`. Coordinates outside valid ranges give `BAD_REQUEST`.

### `GET /api/map/properties`

Properties as point features with `{ "id", "title", "base_price", "distance_meters" }`. Takes the same `q`, `min_price`, `max_price`, `lat`, `lng` and `radius` filters as `GET /api/properties`, without pagination. With a centre, features are nearest first. Without one, the layer holds every property (about 1,000), which MapLibre can cluster on the client.

### `GET /api/map/area`

The search radius as a polygon feature (64 sides, counter-clockwise, closed), for a fill or outline layer around the origin. Query: `lat`, `lng` (default IIIT Hyderabad) and `radius` (metres, default 5000, at most 50,000).

### `GET /api/map/density`

Runs `buildRadialDensityPipeline`: pin counts in 1 km rings around the centre. This is chart data, so it stays plain JSON.

```json
{ "center": { "lat": 17.4455, "lng": 78.3489 }, "radius_meters": 5000, "generated_at": "…",
  "items": [ { "ring_start_km": 0, "ring_end_km": 1, "pin_drops_count": 212, "unique_searchers": 190, "avg_distance_m": 540.2 } ] }
```

## Reviews (Workflow 4)

### `GET /api/reviews/analytics`

Runs `buildReviewAnalyticsPipeline` from `mongo/03_workflow4_facet.js` on `PropertyReviews`.

| Query | Notes |
|---|---|
| `property_id` | Optional. Without it, the facets cover all reviews |

```json
{
  "overall_summary": {
    "total_reviews": 4870,
    "overall_avg_rating": 3.91,
    "min_rating": 1,
    "max_rating": 5,
    "sub_category_averages": { "cleanliness": 4.02, "location": 4.11, "communication": 3.88 }
  },
  "rating_distributions": [ { "rating": 5, "count": 1800, "percentage": 37.0 } ],
  "most_frequent_tags": [ { "tag": "it_corridor", "frequency": 900, "avg_rating": 4.1 } ]
}
```

`rating_distributions` always has all five stars, with zero counts where needed. With no reviews, `total_reviews` is 0 and the averages are `null`.

### `GET /api/reviews`

| Query | Notes |
|---|---|
| `property_id` | Optional filter |
| `tag` | Optional. Only reviews with this location tag, for example after clicking a bar in the top-tags chart |
| `rating` | Optional, 1 to 5. Matches the facet's buckets, so `4` means 4 up to but not including 5 |
| `page`, `limit` | Pagination, newest first |

Item: `{ "id", "property_id", "guest_id", "booking_id", "rating", "sub_ratings", "location_tags", "review_text", "created_at" }`. `id` is the MongoDB `_id` as a hex string.

### `GET /api/reviews/eligibility`

Query: `guest_id` and `property_id`, both required. Returns `{ "eligible", "booking_id", "reason" }`. `reason` is `ELIGIBLE`, `NO_COMPLETED_STAY` or `ALREADY_REVIEWED`. `booking_id` is the oldest COMPLETED stay at the property with no review yet.

### `POST /api/reviews`

Body: `guest_id`, `property_id`, `rating` (whole number, 1 to 5), `review_text` (3 to 2000 characters), `location_tags` (1 to 5 from the seeded tag list) and optional `sub_ratings`. The API looks up the guest's COMPLETED stay in PostgreSQL, then inserts into `PropertyReviews` with that `booking_id`. Returns 201 with the review. A guest can leave one review per completed stay.

Errors: `NO_COMPLETED_STAY` (403), `ALREADY_REVIEWED` (409), `BAD_REQUEST` (400).

## Which screen uses what

| Screen | Endpoints |
|---|---|
| Guest switcher | `GET /guests` (with `sort=balance_asc` or `has_active_stay` for demo picks), `GET /guests/:id` |
| Properties list and detail | `GET /properties`, `GET /properties/:id`, `GET /properties/:id/amenities`, `GET /reviews/analytics?property_id=`, `GET /reviews`, `GET /reviews/eligibility`, `POST /reviews` |
| Book a stay | `GET /guests/:id`, `POST /bookings`, `POST /guests/:id/top-up` |
| Guests and bookings (operations) | `GET /guests`, `GET /bookings`, `PATCH /bookings/:id/status` |
| Audit trail | `GET /guests/:id/audit` |
| Analytics | `GET /analytics/moving-average` (no parameters on first load), `GET /analytics/rank`, `GET /analytics/summary`, `POST /analytics/summary/refresh` |
| Map | `GET /map/hotspots`, `GET /map/pins` (polled with `after`), `POST /map/pins`, `GET /map/properties`, `GET /map/area`, `GET /map/density` |
| Reviews | `GET /reviews/analytics`, `GET /reviews` (with `tag` from the chart), `GET /properties/:id/amenities` |
