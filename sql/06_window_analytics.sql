DROP FUNCTION IF EXISTS fn_property_revenue_rank(DATE, INT);
DROP FUNCTION IF EXISTS fn_property_moving_avg(DATE, DATE, UUID);

CREATE OR REPLACE FUNCTION fn_property_moving_avg(
    p_from DATE,
    p_to DATE,
    p_property_id UUID DEFAULT NULL
)
RETURNS TABLE (property_id UUID, title VARCHAR, day DATE, daily_revenue NUMERIC, moving_avg_7d NUMERIC)
LANGUAGE sql STABLE
AS $$
    WITH days AS (
        SELECT d::date AS day
        FROM generate_series((p_from - 6)::timestamp, p_to::timestamp, INTERVAL '1 day') AS d
    ),
    daily_revenue AS (
        SELECT b.property_id,
               (b.created_at AT TIME ZONE 'UTC')::date AS day,
               SUM(b.total_cost) AS revenue
        FROM bookings b
        WHERE b.status = 'COMPLETED'
          AND b.created_at >= (p_from - 6)::timestamp AT TIME ZONE 'UTC'
          AND b.created_at < (p_to + 1)::timestamp AT TIME ZONE 'UTC'
          AND (p_property_id IS NULL OR b.property_id = p_property_id)
        GROUP BY b.property_id, (b.created_at AT TIME ZONE 'UTC')::date
    ),
    grid AS (
        SELECT p.id AS property_id, p.title, d.day, COALESCE(r.revenue, 0) AS revenue
        FROM properties p
        CROSS JOIN days d
        LEFT JOIN daily_revenue r ON r.property_id = p.id AND r.day = d.day
        WHERE p_property_id IS NULL OR p.id = p_property_id
    ),
    moving AS (
        SELECT g.property_id,
               g.title,
               g.day,
               g.revenue,
               AVG(g.revenue) OVER (
                   PARTITION BY g.property_id
                   ORDER BY g.day
                   ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
               ) AS moving_avg_7d
        FROM grid g
    )
    SELECT m.property_id, m.title, m.day, m.revenue, ROUND(m.moving_avg_7d, 2)
    FROM moving m
    WHERE m.day >= p_from
    ORDER BY m.property_id, m.day;
$$;

CREATE OR REPLACE FUNCTION fn_property_revenue_rank(
    p_as_of DATE,
    p_limit INT DEFAULT NULL
)
RETURNS TABLE (revenue_rank BIGINT, property_id UUID, title VARCHAR, moving_avg_7d NUMERIC)
LANGUAGE sql STABLE
AS $$
    WITH ranked AS (
        SELECT DENSE_RANK() OVER (ORDER BY m.moving_avg_7d DESC) AS revenue_rank,
               m.property_id,
               m.title,
               m.moving_avg_7d
        FROM fn_property_moving_avg(p_as_of, p_as_of) m
    )
    SELECT r.revenue_rank, r.property_id, r.title, r.moving_avg_7d
    FROM ranked r
    WHERE p_limit IS NULL OR r.revenue_rank <= p_limit
    ORDER BY r.revenue_rank, r.title;
$$;
