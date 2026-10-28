#!/usr/bin/env bash
# V265 ACL cutover: all work in disposable PG16. It does not deploy migrations.
set -Eeuo pipefail
: "${PG_CONTAINER:?isolated PG16 required}"
[[ "$PG_CONTAINER" =~ ^[A-Za-z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_acl_cutover_v265
pg createdb -U postgres "$db"
run(){ pg psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" | tr -d '\r'; }
apply(){ pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v265-atomic-rpc-cutover.sql; }
reject(){ if apply >/dev/null 2>&1; then echo "UNEXPECTED cutover success: $1" >&2; exit 1; fi; }
eq(){ [[ "$1" == "$2" ]] || { echo "Expected [$2], got [$1]" >&2; exit 1; }; }
P=00000000-0000-0000-0000-000000000001
run "DO \$\$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 END \$\$;
 CREATE SCHEMA sacramentum_ledger;
 CREATE TABLE sacramentum_ledger.book_memories(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 parish_id uuid,sacrament text,book_type text,book_code text,
 canonical_code text GENERATED ALWAYS AS (
  CASE WHEN book_code ~ '^[0-9]+$'
    THEN coalesce(nullif(ltrim(book_code,'0'),''),'0')
    ELSE upper(book_code) END) STORED,
 legacy_reconciled boolean DEFAULT false,retired_at timestamptz);
 CREATE TABLE sacramentum_ledger.celebration_attestations_v263(id uuid);
 CREATE TABLE sacramentum_ledger.seat_events(id uuid);
 CREATE TABLE sacramentum_ledger.seat_operations(id uuid);" >/dev/null
for table in baptisms confirmations marriages funerals; do
 run "CREATE TABLE public.$table(id uuid PRIMARY KEY,parish_id uuid,book_number text,
 book_type text DEFAULT 'ordinario');" >/dev/null
done
for table in pending_baptisms pending_confirmations pending_marriages pending_funerals; do
 run "CREATE TABLE public.$table(id uuid PRIMARY KEY,parish_id uuid);" >/dev/null
done
# Same signatures as the 4 LIVE original APIs and 4 staged new APIs;
# body intentionally inert. This test concerns only metadata and transaction.
run "CREATE FUNCTION public.seat_baptism_records(uuid,jsonb,integer,integer,integer)
 RETURNS integer LANGUAGE sql AS \$\$ SELECT 1 \$\$;
 CREATE FUNCTION public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)
 RETURNS integer LANGUAGE sql AS \$\$ SELECT 1 \$\$;
 CREATE FUNCTION public.seat_pending_marriage(uuid)
 RETURNS integer LANGUAGE sql AS \$\$ SELECT 1 \$\$;
 CREATE FUNCTION public.seat_funeral_record(jsonb,uuid)
 RETURNS integer LANGUAGE sql AS \$\$ SELECT 1 \$\$;" >/dev/null
for f in seat_baptism_ledger_v263 seat_confirmation_ledger_v263 seat_marriage_ledger_v263 seat_funeral_ledger_v263; do
 run "CREATE FUNCTION public.$f(uuid,uuid,bigint,integer,integer,uuid,jsonb)
 RETURNS jsonb LANGUAGE sql AS \$\$ SELECT '{}'::jsonb \$\$;
 REVOKE ALL ON FUNCTION public.$f(uuid,uuid,bigint,integer,integer,uuid,jsonb)
 FROM PUBLIC,anon,authenticated;" >/dev/null
done
run "CREATE FUNCTION public.get_parish_ledger_seat_context_v264(uuid,text,jsonb)
 RETURNS jsonb LANGUAGE sql AS \$\$ SELECT '{}'::jsonb \$\$;
 CREATE FUNCTION public.attest_new_celebration_v265(uuid,text,uuid,text)
 RETURNS jsonb LANGUAGE sql AS \$\$ SELECT '{}'::jsonb \$\$;
 REVOKE ALL ON FUNCTION public.seat_baptism_records(uuid,jsonb,integer,integer,integer) FROM PUBLIC,anon;
 REVOKE ALL ON FUNCTION public.seat_confirmation_records(uuid,jsonb,integer,integer,integer) FROM PUBLIC,anon;
 REVOKE ALL ON FUNCTION public.seat_pending_marriage(uuid) FROM PUBLIC,anon;
 REVOKE ALL ON FUNCTION public.seat_funeral_record(jsonb,uuid) FROM PUBLIC,anon;
 GRANT EXECUTE ON FUNCTION public.seat_baptism_records(uuid,jsonb,integer,integer,integer) TO authenticated;
 GRANT EXECUTE ON FUNCTION public.seat_confirmation_records(uuid,jsonb,integer,integer,integer) TO authenticated;
 GRANT EXECUTE ON FUNCTION public.seat_pending_marriage(uuid) TO authenticated;
 GRANT EXECUTE ON FUNCTION public.seat_funeral_record(jsonb,uuid) TO authenticated;" >/dev/null
old="public.seat_baptism_records(uuid,jsonb,integer,integer,integer)"
new="public.seat_baptism_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)"
eq "$(run "SELECT has_function_privilege('authenticated','$old','EXECUTE')")" t
eq "$(run "SELECT has_function_privilege('authenticated','$new','EXECUTE')")" f
reject "not all required physical uniqueness indexes present"
eq "$(run "SELECT has_function_privilege('authenticated','$old','EXECUTE')")" t
eq "$(run "SELECT has_function_privilege('authenticated','$new','EXECUTE')")" f
for data in "baptisms:bautismo" "confirmations:confirmacion" "marriages:matrimonio" "funerals:exequias"; do
 IFS=: read -r table sacrament <<< "$data"
 run "INSERT INTO public.$table(id,parish_id,book_number,book_type)
 VALUES(gen_random_uuid(),'$P','0001A','ordinario');" >/dev/null
 run "INSERT INTO sacramentum_ledger.book_memories(parish_id,sacrament,book_type,book_code,legacy_reconciled)
 VALUES('$P','$sacrament','ordinario','0001A',true);" >/dev/null
done
reject "indexes still absent"
eq "$(run "SELECT has_function_privilege('authenticated','$old','EXECUTE')")" t
run "CREATE UNIQUE INDEX uq_v260_baptism_physical_coordinates
 ON public.baptisms(parish_id,book_number) NULLS NOT DISTINCT;
 CREATE UNIQUE INDEX uq_v260_confirmation_physical_coordinates
 ON public.confirmations(parish_id,book_number) NULLS NOT DISTINCT;
 CREATE UNIQUE INDEX uq_v260_marriage_physical_coordinates
 ON public.marriages(parish_id,book_number) NULLS NOT DISTINCT;
 CREATE UNIQUE INDEX uq_v260_funeral_physical_coordinates
 ON public.funerals(parish_id,book_number) NULLS NOT DISTINCT;" >/dev/null
# Unreconciled memory must abort and keep old API intact.
run "UPDATE sacramentum_ledger.book_memories SET legacy_reconciled=false
 WHERE sacrament='exequias';" >/dev/null
reject "unreconciled book"
eq "$(run "SELECT has_function_privilege('authenticated','$old','EXECUTE')")" t
run "UPDATE sacramentum_ledger.book_memories SET legacy_reconciled=true
 WHERE sacrament='exequias';" >/dev/null
# One actual physical scope without corresponding book memory must abort.
run "UPDATE public.funerals SET book_number='0002A';" >/dev/null
reject "historical book without reconciled memory"
eq "$(run "SELECT has_function_privilege('authenticated','$old','EXECUTE')")" t
run "UPDATE public.funerals SET book_number='0001A';" >/dev/null

before="$(run "SELECT (SELECT count(*) FROM public.baptisms)+(SELECT count(*) FROM public.confirmations)+
 (SELECT count(*) FROM public.marriages)+(SELECT count(*) FROM public.funerals)")"
apply >/dev/null
eq "$(run "SELECT has_function_privilege('authenticated','$old','EXECUTE')")" f
eq "$(run "SELECT has_function_privilege('authenticated','$new','EXECUTE')")" t
eq "$(run "SELECT has_function_privilege('anon','$new','EXECUTE')")" f
eq "$(run "SELECT has_function_privilege('anon','$old','EXECUTE')")" f
eq "$(run "SELECT (SELECT count(*) FROM public.baptisms)+(SELECT count(*) FROM public.confirmations)+
 (SELECT count(*) FROM public.marriages)+(SELECT count(*) FROM public.funerals)")" "$before"
eq "$before" 4
echo "V265 PG16 CUTOVER PASS: all-or-nothing 4 old revoke/4 new grant; missing index, unmatched historical book, unreconciled memory rollback; 4 physical records preserved."
