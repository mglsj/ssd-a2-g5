CREATE OR REPLACE PROCEDURE sp_execute_booking(
    p_guest_id UUID,
    p_property_id UUID,
    p_nights INT,
    OUT booking_id UUID,
    OUT total_cost DECIMAL(10,2),
    OUT balance_before DECIMAL(10,2),
    OUT balance_after DECIMAL(10,2),
    OUT audit_log_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_base_price DECIMAL(10,2);
BEGIN
    IF p_nights IS NULL OR p_nights NOT BETWEEN 1 AND 365 THEN
        RAISE EXCEPTION 'Nights must be between 1 and 365, got %', p_nights
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT g.wallet_balance INTO balance_before
    FROM guests g WHERE g.id = p_guest_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Guest % does not exist', p_guest_id
            USING ERRCODE = 'no_data_found';
    END IF;

    SELECT p.base_price INTO v_base_price
    FROM properties p WHERE p.id = p_property_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Property % does not exist', p_property_id
            USING ERRCODE = 'no_data_found';
    END IF;

    total_cost := v_base_price * p_nights;

    BEGIN
        UPDATE guests g
        SET wallet_balance = g.wallet_balance - total_cost
        WHERE g.id = p_guest_id
        RETURNING g.wallet_balance INTO balance_after;
    EXCEPTION
        WHEN check_violation THEN
            RAISE EXCEPTION 'Insufficient balance: the booking costs % but the wallet has %',
                    total_cost, balance_before
                USING ERRCODE = 'check_violation',
                      CONSTRAINT = 'chk_guests_wallet_nonnegative';
    END;

    INSERT INTO bookings (guest_id, property_id, nights, total_cost, status)
    VALUES (p_guest_id, p_property_id, p_nights, total_cost, 'CONFIRMED')
    RETURNING id INTO booking_id;

    SELECT w.id INTO audit_log_id
    FROM wallet_audit_logs w
    WHERE w.guest_id = p_guest_id
    ORDER BY w.timestamp DESC
    LIMIT 1;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_update_booking_status(
    p_booking_id UUID,
    p_new_status VARCHAR(20),
    OUT previous_status VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_guest_id UUID;
    v_active_booking_id UUID;
BEGIN
    SELECT b.status, b.guest_id INTO previous_status, v_guest_id
    FROM bookings b WHERE b.id = p_booking_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % does not exist', p_booking_id
            USING ERRCODE = 'no_data_found';
    END IF;

    IF NOT ((previous_status = 'CONFIRMED' AND p_new_status = 'CHECKED_IN')
         OR (previous_status = 'CHECKED_IN' AND p_new_status = 'COMPLETED')) THEN
        RAISE EXCEPTION 'A % booking cannot move to %', previous_status, p_new_status
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    BEGIN
        UPDATE bookings SET status = p_new_status WHERE id = p_booking_id;
    EXCEPTION
        WHEN unique_violation THEN
            SELECT b.id INTO v_active_booking_id
            FROM bookings b
            WHERE b.guest_id = v_guest_id AND b.status = 'CHECKED_IN';
            RAISE EXCEPTION 'Guest is already checked in on booking %. Complete that stay first.',
                    v_active_booking_id
                USING ERRCODE = 'unique_violation',
                      CONSTRAINT = 'idx_active_stay';
    END;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_top_up_wallet(
    p_guest_id UUID,
    p_amount DECIMAL(10,2),
    OUT balance_before DECIMAL(10,2),
    OUT balance_after DECIMAL(10,2),
    OUT audit_log_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Top-up amount must be positive, got %', p_amount
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT g.wallet_balance INTO balance_before
    FROM guests g WHERE g.id = p_guest_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Guest % does not exist', p_guest_id
            USING ERRCODE = 'no_data_found';
    END IF;

    UPDATE guests g
    SET wallet_balance = g.wallet_balance + p_amount
    WHERE g.id = p_guest_id
    RETURNING g.wallet_balance INTO balance_after;

    SELECT w.id INTO audit_log_id
    FROM wallet_audit_logs w
    WHERE w.guest_id = p_guest_id
    ORDER BY w.timestamp DESC
    LIMIT 1;
END;
$$;
