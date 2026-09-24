CREATE MATERIALIZED VIEW IF NOT EXISTS mv_property_summary AS
SELECT
    p.id AS property_id,
    p.title,
    COUNT(b.id) AS completed_bookings,
    COALESCE(SUM(b.nights), 0) AS total_nights_booked,
    COALESCE(SUM(b.total_cost), 0) AS gross_revenue
FROM properties p
LEFT JOIN bookings b ON p.id = b.property_id AND b.status = 'COMPLETED'
GROUP BY p.id, p.title;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_property_summary_id ON mv_property_summary (property_id);

CREATE TABLE IF NOT EXISTS mv_refresh_log (
    view_name TEXT PRIMARY KEY,
    refreshed_at TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION refresh_mv_property_summary()
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_refreshed_at TIMESTAMPTZ;
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_summary;

    INSERT INTO mv_refresh_log (view_name, refreshed_at)
    VALUES ('mv_property_summary', clock_timestamp())
    ON CONFLICT (view_name) DO UPDATE SET refreshed_at = EXCLUDED.refreshed_at
    RETURNING refreshed_at INTO v_refreshed_at;

    RETURN v_refreshed_at;
END;
$$ LANGUAGE plpgsql;

SELECT refresh_mv_property_summary();
