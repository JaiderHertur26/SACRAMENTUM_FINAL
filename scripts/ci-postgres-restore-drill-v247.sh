#!/usr/bin/env bash
# V247: PostgreSQL backup/restore of completely fictitious fixtures only.
set -Eeuo pipefail
: "$PG_CONTAINER"
[[ "$PG_CONTAINER" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 2
test -s scripts/fixtures/restore-drill-v247.sql
test -s scripts/fixtures/restore-integrity-v247.sql
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
pg() { docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
echo "Creating source and independent restoration databases, disposable container only."
pg psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE ROLE fixture_reader NOLOGIN" >/dev/null
pg psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE DATABASE sacramentum_fixture_source" >/dev/null
pg psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "CREATE DATABASE sacramentum_fixture_restore" >/dev/null
pg psql -X -v ON_ERROR_STOP=1 -U postgres -d sacramentum_fixture_source -f - < scripts/fixtures/restore-drill-v247.sql >/dev/null
counts_sql="SELECT (SELECT count(*) FROM public.fixture_parishes)::text || ':' || (SELECT count(*) FROM public.fixture_registers) || ':' || (SELECT count(*) FROM public.fixture_decrees) || ':' || (SELECT count(*) FROM public.fixture_documents)"
src_counts="$(pg psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d sacramentum_fixture_source -c "$counts_sql" | tr -d '\r')"
[[ "$src_counts" == "3:5:3:2" ]] || { echo "Wrong source row counts: $src_counts" >&2; exit 1; }
src_digest="$(pg psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d sacramentum_fixture_source -f - < scripts/fixtures/restore-integrity-v247.sql | tr -d '\r')"
[[ "$src_digest" =~ ^[a-f0-9]{32}$ ]] || { echo "Invalid source digest" >&2; exit 1; }
pg pg_dump -U postgres -Fc -d sacramentum_fixture_source > "$workdir/fictional.dump"
test -s "$workdir/fictional.dump"
(cd "$workdir" && sha256sum fictional.dump > fictional.dump.sha256 && sha256sum --check --status fictional.dump.sha256)
cp "$workdir/fictional.dump" "$workdir/corrupted.dump"
printf 'CORRUPTED' | dd of="$workdir/corrupted.dump" bs=1 seek=16 conv=notrunc status=none
orig_hash="$(sha256sum "$workdir/fictional.dump" | cut -d' ' -f1)"
bad_hash="$(sha256sum "$workdir/corrupted.dump" | cut -d' ' -f1)"
[[ "$orig_hash" != "$bad_hash" ]] || { echo "Integrity control failed to detect corruption" >&2; exit 1; }
echo "Restoring custom-format pg_dump into an empty independent PostgreSQL database."
pg pg_restore --exit-on-error --single-transaction --no-owner -U postgres -d sacramentum_fixture_restore < "$workdir/fictional.dump"
dst_counts="$(pg psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d sacramentum_fixture_restore -c "$counts_sql" | tr -d '\r')"
dst_digest="$(pg psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d sacramentum_fixture_restore -f - < scripts/fixtures/restore-integrity-v247.sql | tr -d '\r')"
[[ "$dst_counts" == "$src_counts" && "$dst_digest" == "$src_digest" ]] || { echo "Restore digest or row count mismatch" >&2; exit 1; }
checks="$(pg psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d sacramentum_fixture_restore -c "
SELECT
  (SELECT count(*) FROM pg_constraint WHERE conrelid='public.fixture_registers'::regclass AND contype IN ('u','f','c','p'))::text || ':' ||
  (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname='fixture_registers_parish_idx')::text || ':' ||
  (SELECT relrowsecurity::int FROM pg_class WHERE oid='public.fixture_registers'::regclass)::text || ':' ||
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='fixture_registers')::text
" | tr -d '\r')"
IFS=':' read -r n_constraints n_indexes rls n_policies <<< "$checks"
[[ "$n_constraints" -ge 7 && "$n_indexes" == 1 && "$rls" == 1 && "$n_policies" == 1 ]] || { echo "Schema security check failed $checks" >&2; exit 1; }
rls_count="$(pg psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d sacramentum_fixture_restore -c "
BEGIN; SET LOCAL ROLE fixture_reader;
SELECT set_config('app.fixture_parish','parish-alpha',true);
SELECT count(*) FROM public.fixture_registers;
ROLLBACK;" | grep -E '^[0-9]+$' | tail -1)"
[[ "$rls_count" == 2 ]] || { echo "RLS after restore not preserved: $rls_count" >&2; exit 1; }
if pg psql -X -v ON_ERROR_STOP=1 -U postgres -d sacramentum_fixture_restore -c \
 "INSERT INTO public.fixture_decrees VALUES('invalid','DOES-NOT-EXIST','correction','active')" >/dev/null 2>&1; then
  echo "Restored FK incorrectly allowed orphan decree" >&2; exit 1
fi
if pg psql -X -v ON_ERROR_STOP=1 -U postgres -d sacramentum_fixture_restore -c \
 "INSERT INTO public.fixture_registers VALUES('INVALID','parish-alpha','baptism',1,1,1,'seated')" >/dev/null 2>&1; then
  echo "Restored unique coordinates incorrectly allowed collision" >&2; exit 1
fi
echo "V247 REAL POSTGRES FIXTURE RESTORE PASSED: pg_dump -Fc, pg_restore, hash verification, corruption detection, $dst_counts fictional rows, RLS, FK, unique constraints."
echo "This does NOT restore a real Supabase backup or certify the full SACRAMENTUM schema."
