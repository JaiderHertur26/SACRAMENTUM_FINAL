#!/usr/bin/env bash
# V267: all actions occur inside an ISOLATED, THROWAWAY PostgreSQL 16 database.
set -Eeuo pipefail
: "${PG_CONTAINER:?isolated PG16 required}"
[[ "$PG_CONTAINER" =~ ^[A-Za-z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_fresh_official_v267
pg createdb -U postgres "$db"
run(){ pg psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" | tr -d '\r'; }
reject(){ if run "$1" >/dev/null 2>&1; then echo "Unexpected success: $2" >&2; exit 1; fi; }
eq(){ [[ "$1" == "$2" ]] || { echo "Expected [$2] got [$1]" >&2; exit 1; }; }
apply(){ pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v267-fresh-zero-rpc-cutover.sql; }
rejectCutover(){ if apply >/dev/null 2>&1; then echo "Unexpected GoLive: $1" >&2; exit 1; fi; }
# Generate exactly 82 PUBLIC tables with the V267 26/56 classification and
# sacramental stub columns for capability/ACL checks.
node scripts/fixture-fresh-zero-v267.mjs | pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/qa-v252-ledger-memory-schema.sql >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/qa-v253-ledger-transactions.sql >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v267-first-official-book.sql >/dev/null

OLD='public.seat_baptism_records(uuid,jsonb,integer,integer,integer)'
NEW='public.seat_baptism_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)'
eq "$(run "SELECT has_function_privilege('authenticated','$OLD','EXECUTE')")" t
eq "$(run "SELECT has_function_privilege('authenticated','$NEW','EXECUTE')")" f
eq "$(run "SELECT count(*) FROM pg_tables WHERE schemaname='public'")" 82
eq "$(run "SELECT count(*) FROM public.parish_parameters")" 1
eq "$(run "SELECT bautizos_params->>'numeroRegistroActual' FROM public.parish_parameters")" 000053
# Realistic surviving test imports, not just four official register tables.
run "INSERT INTO public.legacy_archive_records(parish_id) VALUES
 ('00000000-0000-0000-0000-000000000001');" >/dev/null
rejectCutover "hidden legacy imported test rows must prevent go-live"
eq "$(run "SELECT has_function_privilege('authenticated','$OLD','EXECUTE')")" t
eq "$(run "SELECT has_function_privilege('authenticated','$NEW','EXECUTE')")" f
eq "$(run "SELECT bautizos_params->>'numeroRegistroActual' FROM public.parish_parameters")" 000053
eq "$(run "SELECT to_regclass('sacramentum_ledger.go_live_receipt_v267') IS NULL")" t
run "DELETE FROM public.legacy_archive_records;" >/dev/null
run "CREATE TABLE public.new_unreviewed_table_v267(id uuid PRIMARY KEY);" >/dev/null
rejectCutover "unknown newly added public table must block release"
run "DROP TABLE public.new_unreviewed_table_v267;" >/dev/null
# No physical records in the official fresh start. No historical reconciliation
# and no requirement to invent a first book before the first official pending.
apply >/dev/null
eq "$(run "SELECT count(*) FROM sacramentum_ledger.go_live_receipt_v267
  WHERE mode='FRESH_FROM_ZERO' AND reset_scope_total=56
    AND institutional_tables_preserved=26")" 1
eq "$(run "SELECT has_function_privilege('authenticated','$OLD','EXECUTE')")" f
eq "$(run "SELECT has_function_privilege('authenticated','$NEW','EXECUTE')")" t
eq "$(run "SELECT has_function_privilege('anon','$NEW','EXECUTE')")" f
eq "$(run "SELECT has_function_privilege('authenticated',
 'public.open_first_official_book_v267(uuid,text,uuid,text,integer,integer,integer,boolean)','EXECUTE')")" t
eq "$(run "SELECT count(*) FROM public.parish_parameters")" 1
eq "$(run "SELECT (bautizos_params->>'numeroRegistroActual')||':'||(confirmaciones_params->>'numeroRegistroActual')||':'||(matrimonios_params->>'numeroRegistroActual')||':'||(exequias_params->>'numeroRegistroActual') FROM public.parish_parameters")" '000000:000000:0000:0000'
eq "$(run "SELECT bautizos_params->>'partidasPorFolio' FROM public.parish_parameters")" 2
eq "$(run "SELECT count(*) FROM public.user_profiles")" 2
rejectCutover "no GoLive re-entry after receipt"
P=00000000-0000-0000-0000-000000000001
USER=00000000-0000-0000-0000-000000000030
OTHER=00000000-0000-0000-0000-000000000031
PID=11111111-0000-0000-0000-000000000001
PID2=11111111-0000-0000-0000-000000000002
run "INSERT INTO public.pending_baptisms(id,parish_id,status,reportado) VALUES('$PID','$P','pending',false);
 INSERT INTO sacramentum_ledger.celebration_attestations_v263
 VALUES('$PID','$P','bautismo','new_sacrament',clock_timestamp(),'$USER','ACTA-REAL-PRUEBA');" >/dev/null
openBook(){ echo "SELECT public.open_first_official_book_v267(
  '$P','bautismo','$PID','0001A',8,50,2,false);"; }
reject "$(openBook)" "unauthorized session"
reject "SET qa.actor='$OTHER'; $(openBook)" "chancery does not initialize a parish book"
answer="$(run "SET qa.actor='$USER'; $(openBook)")"
[[ "$answer" == *'"existing": false'* ]] || { echo "Missing initial book opening: $answer"; exit 1; }
answer="$(run "SET qa.actor='$USER'; $(openBook)")"
[[ "$answer" == *'"existing": true'* ]] || { echo "Unstable same-request retry: $answer"; exit 1; }
eq "$(run "SELECT first_folio||':'||first_partida||':'||book_code FROM sacramentum_ledger.book_memories")" 8:50:0001A
eq "$(run "SELECT count(*) FROM public.baptisms")" 0
eq "$(run "SELECT count(*) FROM public.registry_audit_log WHERE action='first_official_book_opened'")" 1
reject "SET qa.actor='$USER'; SELECT public.open_first_official_book_v267(
  '$P','bautismo','$PID','0001A',9,50,2,false);" "cannot silently change initial folio"
run "INSERT INTO public.pending_confirmations(id,parish_id,status,reportado) VALUES('$PID2','$P','pending',false);
 INSERT INTO sacramentum_ledger.celebration_attestations_v263
 VALUES('$PID2','$P','confirmacion','new_sacrament',clock_timestamp(),'$USER','ACTA-REAL-PRUEBA2');" >/dev/null
run "CREATE FUNCTION public.v267_force_audit_failure() RETURNS trigger LANGUAGE plpgsql
 AS \$\$ BEGIN RAISE EXCEPTION 'Forced first-book audit rollback'; END \$\$;
 CREATE TRIGGER t_v267_force_audit_failure BEFORE INSERT ON public.registry_audit_log
 FOR EACH ROW EXECUTE FUNCTION public.v267_force_audit_failure();" >/dev/null
reject "SET qa.actor='$USER'; SELECT public.open_first_official_book_v267(
  '$P','confirmacion','$PID2','0002A',1,1,2,false);" "audit failure must roll back memory"
eq "$(run "SELECT count(*) FROM sacramentum_ledger.book_memories")" 1
echo "V267 PG16 PASS: exact 56-table zero guard; 26 institutional masters preserved; stray test archives and unknown tables block; 4-old/4-new ACL atomic; first Book 0001A Folio 8 Partida 50 only manual, idempotent, unauthorized rejected and audit rollback."
