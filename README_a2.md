# StaySpot

Vacation rental database (PostgreSQL + MongoDB) from Assignment 1, with a web front end for Assignment 2.

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
mongosh "$MONGO_URI" mongo/02_workflow3_geonear.js   # 3. search hotspots
mongosh "$MONGO_URI" mongo/03_workflow4_facet.js     # 4. review analytics
psql "$PG_URI" -f scripts/explain_postgres.sql       # EXPLAIN ANALYZE for the SQL workflows
```

To regenerate the performance files:

```bash
psql "$PG_URI" -f scripts/explain_postgres.sql > performance/postgres_explain_analyzes.txt
{ echo "["
  mongosh "$MONGO_URI" --quiet --eval "var EXPLAIN = true" -f mongo/02_workflow3_geonear.js
  echo ","
  mongosh "$MONGO_URI" --quiet --eval "var EXPLAIN = true" -f mongo/03_workflow4_facet.js
  echo "]"; } > performance/mongo_execution_stats.json
```


