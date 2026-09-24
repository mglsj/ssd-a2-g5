-- Regenerates postgres_explain_analyzes.txt:
--   psql "$PG_URI" -f scripts/explain_postgres.sql > performance/postgres_explain_analyzes.txt
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
