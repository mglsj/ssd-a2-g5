# Handover note

We inherited the StaySpot (Project 3) Assignment 1 repository. Before changing anything, we ran the original scripts on PostgreSQL and MongoDB in our dev container.

## What worked

- The repository followed the required folder layout, and every SQL and Mongo script loaded without errors.
- The wallet audit trigger wrote correct DEBIT and CREDIT rows.
- The partial unique index `idx_active_stay` had the right definition.
- The Mongo validators, the 2dsphere index and the 2-hour TTL index were correct, and the `$geoNear` and `$facet` pipelines ran and used their indexes.
- The README listed two of the bugs below under "Known issues", which saved us time.

## What did not work

We reproduced each of these on a scratch database:

1. The seeder failed on its first bookings batch. The status CHECK allowed `'CHECKED IN'`, but the seeder and the index used `'CHECKED_IN'`.
2. With the CHECK fixed, the seeder failed again on `idx_active_stay`, because it gave some guests more than one CHECKED_IN booking.
3. After seeding, `mv_property_summary` had 0 rows. Nothing refreshed it.
4. `sp_execute_booking` caught every error and printed a NOTICE. A booking the guest could not afford still returned `CALL` with exit code 0, so a caller could not detect the failure.
5. A negative cost passed to `sp_execute_booking` added money to the wallet (52.01 became 552.01 with a cost of -500).
6. The seeder wrote random audit rows. For 999 of 1000 guests, the wallet balance did not match their latest audit row.
7. Audit rows could be edited with UPDATE, although the assignment asks for an immutable log.

We also found problems by reading the code:

- Workflow 2 used a 7-row window over days that had bookings. With about 20 completed bookings per property per year, that window often spanned months. It also ranked (property, day) rows, not properties.
- The Workflow 2 plan in the performance file showed a sequential scan, although Assignment 1 asks for proof that indexes are used.
- `total_nights_booked` in the materialized view counted bookings, because the schema had no nights column.
- The reviews seeder assigned each review to a random property and only produced 3 to 5 star ratings. Workflow 4 therefore never showed 1 or 2 star buckets.
- Seeded search pins all expired 2 hours after seeding, which leaves the map empty during a demo.

## What we changed and why

### Schema and procedures

- The status CHECK uses `CHECKED_IN`, matching the index and the seeder.
- `bookings` has a `nights` column. The booking procedure prices a stay as `base_price * nights`, and the materialized view sums real nights.
- New CHECK constraints cover prices, costs, coordinates and audit amounts, and every timestamp is NOT NULL.
- `wallet_audit_logs` is append-only: a trigger rejects UPDATE and DELETE. The audit trigger stamps rows with `clock_timestamp()`, so two wallet changes in one transaction keep their order.
- `sp_execute_booking` raises an error that names the problem (insufficient balance, unknown guest or property, invalid nights), so the front end can show it. It returns the booking id, the balances before and after, and the audit row id.
- New procedures: `sp_update_booking_status` (CONFIRMED to CHECKED_IN to COMPLETED; a second check-in fails on `idx_active_stay`, which is how the UI demonstrates the partial index) and `sp_top_up_wallet`.
- Workflow 2 is two SQL functions: a 7-day moving average per property over a gap-free daily grid, and a DENSE_RANK of properties. Two partial covering indexes remove the sequential scan.
- `refresh_mv_property_summary()` records its time in `mv_refresh_log` for the "last refreshed" label.
- Every SQL file can be re-run on an existing database.

### Mongo

- `SearchSessions` has a compound `{location: "2dsphere", created_at: 1}` index instead of the single-field one. It is still a 2dsphere index on `location`, and the 2-hour recency filter now runs inside the index scan.
- Workflow 3 takes any center point and defaults to IIIT Hyderabad. Workflow 4 always returns all five rating buckets.
- Each workflow script builds its pipelines in functions. mongosh runs the workflow, and `require()` from Node returns only the builders, so the API runs the same pipelines.
- With `--eval "var EXPLAIN = true"`, a script prints only its explain output as JSON. The scripts no longer write files.
- `01_collections_and_indexes.js` defines each validator and index once and applies strict validation on create and on update. `PropertyAmenities` accepts the `star_rating` and `guest_rating` of real listings.

### Seed data

- All data is set in Hyderabad, with Indian names and rupee amounts. 209 properties are real listings from trivago searches around IIIT Hyderabad, with their names, coordinates, prices, amenities and ratings. Synthetic homes fill the rest near 32 weighted localities.
- The Postgres seeder builds a ledger per guest that ends at their wallet balance, gives each guest at most one CHECKED_IN booking, refreshes the materialized view and runs `VACUUM ANALYZE`.
- Every review belongs to a real COMPLETED booking and uses 1 to 5 stars. Search pins use real guest ids, and `--live` keeps inserting fresh pins after the 2-hour TTL.
- 45% of search pins fall within 5 km of IIIT. With the compound index, Workflow 3 went from about 4 s to under 2 s.
- The Mongo seeder builds plain dictionaries, so `pydantic` is no longer a dependency. Both seeders use builtin type hints instead of `typing`.

### Tooling

- A dev container runs PostgreSQL, MongoDB and a devenv shell with uv. `data_generation/` is a uv project, and `requirements.txt` is exported from `uv.lock`.
- `scripts/setup_db.sh` resets and seeds both databases. `scripts/regenerate_performance.sh` rewrites both performance files.
- We regenerated the performance files, the ERD and the Mongo schema map.

## Suggestions for the original authors

- Run the whole setup on an empty database before submitting. Items 1 to 3 above appear on the first run.
- Let procedures raise errors instead of printing NOTICEs. A caller can catch an error but cannot see a NOTICE.
- After seeding, run a few queries that check your own rules, such as "at most one CHECKED_IN booking per guest" and "wallet balance equals the latest audit row".
- Run `VACUUM ANALYZE` before capturing EXPLAIN output, and paste the raw plans into the README as the assignment asks.
