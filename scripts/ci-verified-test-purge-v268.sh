#!/usr/bin/env bash
# V268 only uses a disposable PostgreSQL 16 container and two disposable DBs.
set -Eeuo pipefail
: "${PG_CONTAINER:?Requires isolated PostgreSQL16}"
[[ "$PG_CONTAINER" =~ ^[A-Za-z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_purge_v268
restore_db=sacramentum_restore_v268
pg createdb -U postgres "$db"
run(){ pg psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" | tr -d '\r'; }
eq(){ [[ "$1" == "$2" ]] || { echo "Expected [$2], got [$1]" >&2; exit 1; }; }
should_fail(){ if "$@" >/dev/null 2>&1; then echo "Unexpected successful unsafe operation" >&2; exit 1; fi; }
apply(){
 local hash="${1:-}" restored="${2:-true}" ticket="${3:-CHG-2026-10-28-TEST}"
 { echo "SET sacramentum.v268.backup_sha256 TO '$hash';"
   echo "SET sacramentum.v268.restore_verified TO '$restored';"
   echo "SET sacramentum.v268.authorization_ticket TO '$ticket';"
   cat scripts/staged-v268-transactional-test-purge.sql;
 } | pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db"
}
node scripts/fixture-fresh-zero-v267.mjs | pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" >/dev/null
# Model the EXACT live exception: an institutional parish has an obsolete
# pointer to test import origins; origins themselves reference installations.
run "ALTER TABLE public.parishes ADD COLUMN legacy_origin_id uuid;
 ALTER TABLE public.legacy_source_origins ADD COLUMN source_installation_id uuid;
 ALTER TABLE public.legacy_source_origins ADD COLUMN parent_origin_id uuid;
 ALTER TABLE public.parishes ADD CONSTRAINT parishes_legacy_origin_id_fkey
 FOREIGN KEY(legacy_origin_id) REFERENCES public.legacy_source_origins(id) ON DELETE SET NULL;
 ALTER TABLE public.legacy_source_origins ADD CONSTRAINT legacy_source_origins_source_installation_id_fkey
 FOREIGN KEY(source_installation_id) REFERENCES public.legacy_source_installations(id) ON DELETE CASCADE;
 ALTER TABLE public.legacy_source_origins ADD CONSTRAINT legacy_source_origins_parent_origin_id_fkey
 FOREIGN KEY(parent_origin_id) REFERENCES public.legacy_source_origins(id) ON DELETE SET NULL;
 CREATE SCHEMA storage;
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
 CREATE TABLE auth.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
 INSERT INTO auth.users DEFAULT VALUES;" >/dev/null

P=00000000-0000-0000-0000-000000000001
I=00000000-0000-0000-0000-000000000090
O=00000000-0000-0000-0000-000000000091
run "INSERT INTO public.legacy_source_installations(id,parish_id) VALUES('$I','$P');
 INSERT INTO public.legacy_source_origins(id,parish_id,source_installation_id)
 VALUES('$O','$P','$I');
 UPDATE public.parishes SET legacy_origin_id='$O' WHERE id='$P';
 INSERT INTO public.legacy_archive_records(parish_id) VALUES('$P');
 INSERT INTO public.legacy_import_rows(parish_id) VALUES('$P');
 INSERT INTO public.pending_baptisms(parish_id) VALUES('$P');
 INSERT INTO public.baptisms(parish_id,book_number,folio,number)
 VALUES('$P','0001','0001','0001');
 INSERT INTO public.confirmations(parish_id,book_number,folio,number)
 VALUES('$P','0001','0001','0001');
 INSERT INTO public.decretos(parish_id) VALUES('$P');
 INSERT INTO public.registry_audit_log(parish_id,action) VALUES('$P','test_activity');" >/dev/null
eq "$(run "SELECT count(*) FROM public.parishes WHERE legacy_origin_id IS NOT NULL")" 1
eq "$(run "SELECT count(*) FROM public.baptisms")" 1
eq "$(run "SELECT count(*) FROM public.legacy_source_installations")" 1

# Unverified no-backup calls may never change a table or create a receipt.
should_fail apply ''
should_fail apply "$(printf '%064d' 1)" false
eq "$(run "SELECT count(*) FROM public.baptisms")" 1
eq "$(run "SELECT to_regclass('sacramentum_ledger.purge_receipts_v268') IS NULL")" t

pg pg_dump -U postgres -Fc -f "/tmp/${db}.dump" "$db"
pg createdb -U postgres "$restore_db"
pg pg_restore -U postgres --no-owner --no-privileges -d "$restore_db" "/tmp/${db}.dump"
restored_count="$(pg psql -X -q -A -t -U postgres -d "$restore_db" -c "SELECT count(*) FROM public.baptisms" | tr -d '\r')"
eq "$restored_count" 1
eq "$(pg psql -X -q -A -t -U postgres -d "$restore_db" -c \
 "SELECT count(*) FROM public.parishes WHERE legacy_origin_id IS NOT NULL" | tr -d '\r')" 1
HASH="$(pg sha256sum "/tmp/${db}.dump" | awk '{print $1}')"
[[ "$HASH" =~ ^[0-9a-f]{64}$ ]] || exit 1

# The independent verified backup remains unchanged across negative cases.
run "INSERT INTO storage.objects DEFAULT VALUES;" >/dev/null
should_fail apply "$HASH"
eq "$(run "SELECT count(*) FROM public.baptisms")" 1
run "DELETE FROM storage.objects;" >/dev/null
run "CREATE TABLE public.unclassified_v268(id uuid PRIMARY KEY);" >/dev/null
should_fail apply "$HASH"
run "DROP TABLE public.unclassified_v268;" >/dev/null
# Inject an unexpected institutional -> transactional FK.
run "ALTER TABLE public.parishes ADD COLUMN v268_invalid_baptism_id uuid;
 ALTER TABLE public.parishes ADD CONSTRAINT v268_invalid_preserved_fk
 FOREIGN KEY(v268_invalid_baptism_id) REFERENCES public.baptisms(id);" >/dev/null
should_fail apply "$HASH"
run "ALTER TABLE public.parishes DROP CONSTRAINT v268_invalid_preserved_fk;
 ALTER TABLE public.parishes DROP COLUMN v268_invalid_baptism_id;" >/dev/null

apply "$HASH" true "CHG-2026-10-28-VERIFIED-RESET" >/dev/null
eq "$(run "SELECT discarded_table_count FROM sacramentum_ledger.purge_receipts_v268")" 56
eq "$(run "SELECT preserved_table_count FROM sacramentum_ledger.purge_receipts_v268")" 26
eq "$(run "SELECT discarded_rows FROM sacramentum_ledger.purge_receipts_v268")" 9
eq "$(run "SELECT parishes_test_origin_refs_removed FROM sacramentum_ledger.purge_receipts_v268")" 1
eq "$(run "SELECT backup_sha256 FROM sacramentum_ledger.purge_receipts_v268")" "$HASH"
eq "$(run "SELECT count(*) FROM public.parishes WHERE legacy_origin_id IS NOT NULL")" 0
eq "$(run "SELECT count(*) FROM public.parishes")" 1
eq "$(run "SELECT count(*) FROM public.user_profiles")" 2
eq "$(run "SELECT count(*) FROM public.parish_parameters")" 1
eq "$(run "SELECT count(*) FROM auth.users")" 1
eq "$(run "SELECT count(*) FROM public.baptisms")" 0
eq "$(run "SELECT count(*) FROM public.legacy_source_origins")" 0
eq "$(run "SELECT count(*) FROM public.legacy_source_installations")" 0
eq "$(run "SELECT count(*) FROM public.legacy_archive_records")" 0
eq "$(run "SELECT count(*) FROM public.registry_audit_log")" 0
# Restore drill proves retained backup is still the original pre-purge DB.
eq "$(pg psql -X -q -A -t -U postgres -d "$restore_db" -c \
 "SELECT count(*) FROM public.baptisms" | tr -d '\r')" 1
eq "$(pg psql -X -q -A -t -U postgres -d "$restore_db" -c \
 "SELECT count(*) FROM public.parishes WHERE legacy_origin_id IS NOT NULL" | tr -d '\r')" 1
should_fail apply "$HASH"
echo "V268 PG16 PASS: backup dump+actual restore, exact 56-table test cleanup (54 TRUNCATE RESTRICT + 2 DELETE), one parish import pointer unlinked, 26 master tables preserved, storage/FK/schema/authorization guards, rollback, and no second purge."
