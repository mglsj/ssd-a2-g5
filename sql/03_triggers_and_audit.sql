CREATE OR REPLACE FUNCTION log_guest_wallet_update()
RETURNS TRIGGER AS $$
DECLARE
    v_action_type VARCHAR(10);
    v_amount_changed DECIMAL(10,2);
BEGIN
    v_amount_changed := NEW.wallet_balance - OLD.wallet_balance;
    
    IF v_amount_changed < 0 THEN
        v_action_type := 'DEBIT';
    ELSE
        v_action_type := 'CREDIT';
    END IF;
    
    INSERT INTO wallet_audit_logs(guest_id, amount_changed, action_type, balance_after, timestamp)
    VALUES (NEW.id, ABS(v_amount_changed), v_action_type, NEW.wallet_balance, NOW());
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER guest_wallet_audit_trigger
AFTER UPDATE OF wallet_balance ON guests
FOR EACH ROW
WHEN (OLD.wallet_balance IS DISTINCT FROM NEW.wallet_balance)
EXECUTE FUNCTION log_guest_wallet_update();

CREATE OR REPLACE FUNCTION prevent_audit_log_change()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'wallet_audit_logs is append-only: % is not allowed', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER wallet_audit_logs_immutable
BEFORE UPDATE OR DELETE ON wallet_audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_change();
