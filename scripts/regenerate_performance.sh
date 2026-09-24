#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

: "${PG_URI:?set PG_URI}"
: "${MONGO_URI:?set MONGO_URI}"

echo "== PostgreSQL EXPLAIN ANALYZE"
psql "$PG_URI" -q -v ON_ERROR_STOP=1 > performance/postgres_explain_analyzes.txt <<'SQL'
\pset footer off
SELECT id AS property_id FROM properties ORDER BY id LIMIT 1 \gset
SELECT guest_id FROM bookings WHERE status = 'CHECKED_IN' ORDER BY guest_id LIMIT 1 \gset
SELECT version();

\echo
\echo ==== Workflow 2: 7-day moving average for one property over 90 days
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM fn_property_moving_avg(CURRENT_DATE - 90, CURRENT_DATE, :'property_id');

\echo
\echo ==== Workflow 2: properties ranked by 7-day moving average (DENSE_RANK)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM fn_property_revenue_rank(CURRENT_DATE, 10);

\echo
\echo ==== idx_active_stay: current CHECKED_IN booking of one guest
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM bookings WHERE guest_id = :'guest_id' AND status = 'CHECKED_IN';

\echo
\echo ==== Audit trail: one guest, last 90 days, newest first
EXPLAIN (ANALYZE, BUFFERS)
SELECT timestamp, action_type, amount_changed, balance_after
FROM wallet_audit_logs
WHERE guest_id = :'guest_id' AND timestamp >= NOW() - INTERVAL '90 days'
ORDER BY timestamp DESC
LIMIT 50;
SQL

# Each workflow script prints only its explain output when EXPLAIN is set.
# Entry 0 is Workflow 3, entry 1 is Workflow 4.
echo "== MongoDB explain(\"executionStats\")"
{
  echo "["
  mongosh "$MONGO_URI" --quiet --eval "var EXPLAIN = true" -f mongo/02_workflow3_geonear.js
  echo ","
  mongosh "$MONGO_URI" --quiet --eval "var EXPLAIN = true" -f mongo/03_workflow4_facet.js
  echo "]"
} > performance/mongo_execution_stats.json

echo "== Done"
