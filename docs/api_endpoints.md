# API endpoints

The API in `api/` is a thin layer between the web front end and the two databases.
It validates input, calls the Assignment 1 procedures, functions and pipelines, and turns database errors into readable messages.
It does not compute business results itself.

## Conventions

- Base path is `/api`. Requests and responses are JSON.
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
| API validation | Missing or malformed field, bad UUID, bad date, unreadable JSON body | 400 | `BAD_REQUEST` |
| PostgreSQL `P0002` (`no_data_found`) | Guest, property or booking does not exist | 404 | `NOT_FOUND` |
| PostgreSQL `22023` (`invalid_parameter_value`) from `sp_execute_booking` or `sp_top_up_wallet` | Nights outside 1 to 365, top-up amount not positive | 422 | `INVALID_INPUT` |
| PostgreSQL `22023` from `sp_update_booking_status` | Transition other than CONFIRMED to CHECKED_IN to COMPLETED | 409 | `INVALID_TRANSITION` |
| PostgreSQL `23514`, constraint `chk_guests_wallet_nonnegative` | Wallet cannot cover the booking | 409 | `INSUFFICIENT_BALANCE` |
| PostgreSQL `23505`, constraint `idx_active_stay` | Guest already has a CHECKED_IN booking | 409 | `ALREADY_CHECKED_IN` |
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
| `sort` | `name` (default) or `balance` |

Item: `{ "id", "name", "wallet_balance" }`

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

Body: `{ "amount": 5000 }`

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
| `from`, `to` | Optional date range, both inclusive |
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
`opening_balance` is the `balance_after` of the last row before `from` (`"0.00"` if there is none), and `closing_balance` is the last row in the range.

## Properties

### `GET /api/properties`

| Query | Notes |
|---|---|
| `q` | Case-insensitive title search. `%` and `_` match literally |
| `min_price`, `max_price` | Filter on `base_price`. Must be non-negative numbers, and `min_price` cannot exceed `max_price` (`400` otherwise) |
| `sort` | `title` (default), `price_asc`, `price_desc`, `revenue` (from `mv_property_summary`). Ties break on `id`, so pages stay stable |
| `page`, `limit` | Pagination |

Item: `{ "id", "title", "base_price", "latitude", "longitude" }`

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

The `PropertyAmenities` document for the property: `amenities`, `house_rules`, `accessibility_features`, `safety_features`, `host_guidelines`, `star_rating`, `guest_rating`, `updated_at`.
Fields vary between documents. `404` if the property has no catalog document, which the UI shows as an empty state.

## Bookings (Workflow 1)

### `GET /api/bookings`

| Query | Notes |
|---|---|
| `guest_id` | Filter by guest (guest mode always sets this) |
| `property_id` | Filter by property |
| `status` | `CONFIRMED`, `CHECKED_IN` or `COMPLETED` |
| `page`, `limit` | Pagination, newest first |

Item: `{ "id", "guest_id", "guest_name", "property_id", "property_title", "nights", "total_cost", "status", "created_at" }`

### `POST /api/bookings`

Books a stay with `CALL sp_execute_booking(guest_id, property_id, nights, NULL, NULL, NULL, NULL, NULL)`.
The procedure locks the guest row, deducts `base_price * nights`, inserts a CONFIRMED booking, and the trigger writes a DEBIT audit row. All of this commits together or not at all.

Body: `{ "guest_id": "…", "property_id": "…", "nights": 3 }`

`201`:

```json
{
  "booking": { "id": "…", "guest_id": "…", "property_id": "…", "nights": 3, "total_cost": "9000.00", "status": "CONFIRMED", "created_at": "…" },
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

Body: `{ "status": "CHECKED_IN" }`

```json
{ "booking": { "id": "…", "status": "CHECKED_IN" }, "previous_status": "CONFIRMED" }
```

Errors:

| `code` | When | `detail` |
|---|---|---|
| `ALREADY_CHECKED_IN` | The guest already has a CHECKED_IN booking | `{ "active_booking_id" }` so the UI can link to it |
| `INVALID_TRANSITION` | Anything other than CONFIRMED to CHECKED_IN or CHECKED_IN to COMPLETED | `{ "from", "to" }` |
| `NOT_FOUND` | Unknown booking | |

## Analytics (Workflow 2 and the materialized view)

### `GET /api/analytics/moving-average`

Calls `fn_property_moving_avg(from, to, property_id)`: completed booking revenue per day and its 7-day moving average over a gap-free daily grid.

| Query | Notes |
|---|---|
| `property_id` | Required. Repeat up to 5 times to compare properties |
| `from`, `to` | Default: the last 90 days. At most 366 days |

```json
{
  "series": [
    {
      "property_id": "…",
      "title": "…",
      "points": [ { "day": "2026-06-01", "daily_revenue": "0.00", "moving_avg_7d": "1285.71" } ]
    }
  ]
}
```

`property_id` is required because the function returns one row per property per day, which is 90,000 rows for all 1,000 properties over 90 days.

### `GET /api/analytics/rank`

Calls `fn_property_revenue_rank(as_of, limit)`: properties ranked by their 7-day moving average with `DENSE_RANK()`.

| Query | Notes |
|---|---|
| `as_of` | Default: today |
| `limit` | Highest rank to include, default 10. Ties share a rank, so more rows than `limit` can come back |

Item: `{ "revenue_rank": 1, "property_id", "title", "moving_avg_7d" }`

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

### `GET /api/hotspots`

Runs `buildHotspotPipeline` from `mongo/02_workflow3_geonear.js` on `SearchSessions`. `$geoNear` finds pins within the radius from the last `since` minutes, then groups them into grid cells about 1 km wide.

| Query | Notes |
|---|---|
| `lat`, `lng` | Centre. Default: IIIT Hyderabad (17.4455, 78.3489) |
| `radius` | Metres, default 5000, at most 5000 |
| `since` | Minutes, default 120 (the TTL window) |
| `sort` | `distance` (default) or `volume` |

```json
{
  "center": { "lat": 17.4455, "lng": 78.3489 },
  "radius_meters": 5000,
  "generated_at": "…",
  "items": [
    {
      "hotspot_cluster": { "type": "Point", "coordinates": [78.35, 17.44] },
      "search_volume": 34,
      "unique_users_count": 31,
      "avg_distance_km": 0.84,
      "min_distance_meters": 120.4,
      "max_distance_meters": 1480.2,
      "latest_search_at": "…",
      "hotspot_status": "CRITICAL_SURGE"
    }
  ]
}
```

The map polls this every 10 seconds. `items` is empty when no pins are recent, for example two hours after seeding without `--live`.

### `GET /api/hotspots/density`

Runs `buildRadialDensityPipeline`: pin counts in 1 km rings around the centre. Same `lat`, `lng`, `radius` and `since` query.

Item: `{ "ring_start_km": 0, "ring_end_km": 1, "pin_drops_count": 212, "unique_searchers": 190, "avg_distance_m": 540.2 }`

### `POST /api/search-sessions`

Adds one search pin, so a new ping can appear on the map during the demo.

Body: `{ "lat": 17.44, "lng": 78.35, "user_id": "…" }`. `user_id` is optional and defaults to the selected guest or `"anonymous"`.

The API fills in `session_id` and `created_at`. `201` returns the stored document. Coordinates outside valid ranges give `BAD_REQUEST`.

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
| `rating` | Optional, 1 to 5 |
| `page`, `limit` | Pagination, newest first |

Item: `{ "id", "property_id", "guest_id", "booking_id", "rating", "sub_ratings", "location_tags", "review_text", "created_at" }`

## Which screen uses what

| Screen | Endpoints |
|---|---|
| Guest switcher | `GET /guests`, `GET /guests/:id` |
| Properties list and detail | `GET /properties`, `GET /properties/:id`, `GET /properties/:id/amenities`, `GET /reviews/analytics?property_id=`, `GET /reviews` |
| Book a stay | `GET /guests/:id`, `POST /bookings`, `POST /guests/:id/top-up` |
| Guests and bookings (operations) | `GET /guests`, `GET /bookings`, `PATCH /bookings/:id/status` |
| Audit trail | `GET /guests/:id/audit` |
| Analytics | `GET /analytics/moving-average`, `GET /analytics/rank`, `GET /analytics/summary`, `POST /analytics/summary/refresh` |
| Map | `GET /hotspots`, `GET /hotspots/density`, `POST /search-sessions` |
| Reviews | `GET /reviews/analytics`, `GET /reviews`, `GET /properties/:id/amenities` |
