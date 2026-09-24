CREATE OR REPLACE FUNCTION log_guest_wallet_update()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallet_audit_logs (guest_id, amount_changed, action_type, balance_after, timestamp)
    VALUES (
        NEW.id,
        ABS(NEW.wallet_balance - OLD.wallet_balance),
        CASE WHEN NEW.wallet_balance < OLD.wallet_balance THEN 'DEBIT' ELSE 'CREDIT' END,
        NEW.wallet_balance,
        clock_timestamp()
    );
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
