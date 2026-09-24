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

### Schema

- The status CHECK now uses `CHECKED_IN`, matching the index and the seeder.
- `bookings` has a `nights` column. The materialized view sums it, and the booking procedure prices a stay as `base_price * nights`.
- New CHECK constraints cover prices, costs, coordinates and audit amounts, and every timestamp is NOT NULL.
- A trigger rejects UPDATE and DELETE on `wallet_audit_logs`.
- New indexes support the browse and audit screens, and two partial covering indexes serve the revenue queries.
- Every SQL file can be re-run on an existing database.

### Procedures and analytics

- `sp_execute_booking` raises an error that names the problem, so the front end can show it. It rejects bad input, and it returns the booking id, the balances before and after, and the audit row id.
- `sp_update_booking_status` moves a booking from CONFIRMED to CHECKED_IN to COMPLETED. A second check-in fails on `idx_active_stay`, which is how the UI demonstrates the partial index.
- `sp_top_up_wallet` adds money and writes a CREDIT row through the trigger.
- Workflow 2 is now two SQL functions. One returns the 7-day moving average per property over a gap-free daily grid. The other ranks properties with DENSE_RANK.
- `refresh_mv_property_summary()` records its time in `mv_refresh_log` and returns it, for the "last refreshed" label.

### Mongo pipelines

- Workflow 3 takes any center point. Its default is Jubilee Hills in Hyderabad.
- Workflow 4 always returns all five rating buckets, with 0 for empty ones.
- Each script builds its pipelines in functions. mongosh runs the workflow, and `require()` from Node returns only the builders, so the API runs the same pipelines.
- With `--eval "var EXPLAIN = true"`, a script prints only its explain output as JSON. The scripts no longer write files.

### Seed data

- All data is Indian and set in Hyderabad. Guest names come from Faker's `en_IN` locale, amounts are in rupees, and properties and search pins sit in Hyderabad localities.
- The Postgres seeder builds a ledger per guest that ends at their wallet balance, and gives each guest at most one CHECKED_IN booking. It refreshes the materialized view and runs `VACUUM ANALYZE` at the end.
- The Mongo seeder reads PostgreSQL first. Every review belongs to a real COMPLETED booking and uses 1 to 5 stars, and every amenities document carries its property title. Search pins use real guest ids.
- `--live` keeps inserting fresh search pins, so the map has data after the 2-hour TTL.
- The seeders use builtin type hints (`list`, `dict`, `X | None`) instead of the `typing` module.

### Tooling and docs

- A dev container runs PostgreSQL, MongoDB and a devenv shell with uv. `data_generation/` is a uv project.
- `scripts/setup_db.sh` resets and seeds both databases in about 40 seconds. `scripts/explain_postgres.sql` regenerates the Postgres performance file.
- We regenerated the performance files, the ERD and the Mongo schema map.

## Suggestions for the original authors

- Run the whole setup on an empty database before submitting. Items 1 to 3 above appear on the first run.
- Let procedures raise errors instead of printing NOTICEs. A caller can catch an error but cannot see a NOTICE.
- After seeding, run a few queries that check your own rules, such as "at most one CHECKED_IN booking per guest" and "wallet balance equals the latest audit row".
- Run `VACUUM ANALYZE` before capturing EXPLAIN output, and paste the raw plans into the README as the assignment asks.
