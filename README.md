# StaySpot

Vacation rental database (PostgreSQL + MongoDB) from Assignment 1, with a web front end for Assignment 2.

## Repository layout

```
README.md
docs/               handover_note.md, api_endpoints.md, design/ (wireframes, users),
                    relational_erd.png, mongo_schema_map.json, README_a1.md
sql/                Assignment 1 schema, indexes, triggers, procedures, views, Workflow 2
mongo/              Assignment 1 collections and indexes, Workflows 3 and 4
data_generation/    Seeders (uv project)
performance/        EXPLAIN ANALYZE and explain("executionStats") output
scripts/            setup_db.sh, regenerate_performance.sh
api/                Server layer
web/                Front end
```

## Setup

Open the repo in the dev container (VS Code: "Reopen in Container"). It starts PostgreSQL and MongoDB and sets `PG_URI` and `MONGO_URI`.
Then build and seed both databases. This takes about 40 seconds and deletes existing StaySpot data.

```bash
bash scripts/setup_db.sh
```

Seeded search pins expire after 2 hours. To keep adding new ones for the map:

```bash
uv run --project data_generation python data_generation/mongo_seeder.py --sessions 0 --live
```

## Workflows

```sql
-- 1. Book a stay, then move it through its statuses
CALL sp_execute_booking('<guest_id>', '<property_id>', 3, NULL, NULL, NULL, NULL, NULL);
CALL sp_update_booking_status('<booking_id>', 'CHECKED_IN', NULL);
CALL sp_top_up_wallet('<guest_id>', 500, NULL, NULL, NULL);

-- 2. 7-day moving average and ranking
SELECT * FROM fn_property_moving_avg(CURRENT_DATE - 90, CURRENT_DATE, '<property_id>');
SELECT * FROM fn_property_revenue_rank(CURRENT_DATE, 10);
SELECT refresh_mv_property_summary();
```

```bash
mongosh "$MONGO_URI" mongo/02_workflow3_geonear.js   # 3. search hotspots within 5 km of IIIT Hyderabad
mongosh "$MONGO_URI" mongo/03_workflow4_facet.js     # 4. review analytics
```

Workflow 3 searches around another point when `HOTSPOT_LNG` and `HOTSPOT_LAT` are set.

## Performance proof

This rewrites `performance/postgres_explain_analyzes.txt` and `performance/mongo_execution_stats.json` from the seeded databases:

```bash
bash scripts/regenerate_performance.sh
```
