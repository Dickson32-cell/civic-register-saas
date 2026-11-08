-- Adds Paystack pending-reference columns to license_state.
-- Apply over the OWNER connection (zc_ roles cannot ALTER):
--   node scripts/apply-ddl.js scripts/add-license-pending.sql
ALTER TABLE license_state
  ADD COLUMN IF NOT EXISTS pending_ref   VARCHAR(60);
ALTER TABLE license_state
  ADD COLUMN IF NOT EXISTS pending_ref_at TIMESTAMPTZ(3);
ALTER TABLE license_state
  ALTER COLUMN license_key TYPE VARCHAR(40);
