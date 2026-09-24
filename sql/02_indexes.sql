CREATE UNIQUE INDEX IF NOT EXISTS idx_active_stay ON bookings (guest_id) WHERE status = 'CHECKED_IN';

CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON bookings (property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_created ON bookings (guest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_completed_property_date
    ON bookings (property_id, created_at) INCLUDE (total_cost, nights)
    WHERE status = 'COMPLETED';
CREATE INDEX IF NOT EXISTS idx_bookings_completed_date
    ON bookings (created_at) INCLUDE (property_id, total_cost)
    WHERE status = 'COMPLETED';

CREATE INDEX IF NOT EXISTS idx_wallet_audit_logs_guest_time ON wallet_audit_logs (guest_id, timestamp DESC);
