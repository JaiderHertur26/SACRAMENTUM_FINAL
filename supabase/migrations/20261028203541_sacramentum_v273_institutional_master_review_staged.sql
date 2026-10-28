BEGIN;
-- V273: review of exactly 26 institutional master datasets before fresh
-- official cutover. STAGED - DO NOT INSTALL YET ON TEST-DATA SUPABASE.
-- This does not authorize deletion or declare any actual master authentic.
-- Evidence is entered only after institutional/technical human review and
-- independent backup-restore; no client RPC can create these approvals.
CREATE TABLE sacramentum_ledger.master_review_v273(
  table_name text PRIMARY KEY CHECK (table_name ~ '^[a-z_0-9]{1,80}$'),
  expected_rows bigint NOT NULL CHECK (expected_rows>=0),
  expected_md5 text NOT NULL CHECK (expected_md5 ~ '^[0-9a-f]{32}$'),
  reviewed_by text NOT NULL CHECK(length(btrim(reviewed_by)) BETWEEN 5 AND 150),
  approved_by text NOT NULL CHECK(length(btrim(approved_by)) BETWEEN 5 AND 150),
  approval_reference text NOT NULL CHECK(length(btrim(approval_reference)) BETWEEN 12 AND 180),
  signed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_v273_two_distinct_signers CHECK (
    lower(btrim(reviewed_by))<>lower(btrim(approved_by)))
);
ALTER TABLE sacramentum_ledger.master_review_v273 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_ledger.master_review_v273 FROM PUBLIC,anon,authenticated;
-- There is NO trigger or function that auto-approves the 26 existing tables.
-- The institutional signers must inspect the complete inventory and hashes.
COMMIT;
