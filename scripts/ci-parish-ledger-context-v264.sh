#!/usr/bin/env bash
# V264 read-only institutional context is verified on disposable PG16.
set -Eeuo pipefail
: "${PG_CONTAINER:?requires disposable PG16}"
[[ "$PG_CONTAINER" =~ ^[A-Za-z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_context_v264
pg createdb -U postgres "$db"
run(){ pg psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" | tr -d '\r'; }
reject(){ if run "$1" >/dev/null 2>&1; then echo "UNEXPECTED SUCCESS: $2" >&2; exit 1; fi; }
eq(){ [[ "$1" == "$2" ]] || { echo "Expected [$2], got [$1]" >&2; exit 1; }; }
P=00000000-0000-0000-0000-000000000001
P2=00000000-0000-0000-0000-000000000002
D=00000000-0000-0000-0000-000000000010
A=00000000-0000-0000-0000-000000000030
BAD=00000000-0000-0000-0000-000000000031
B=11111111-0000-0000-0000-000000000001
PD=22222222-0000-0000-0000-000000000001
run "DO \$\$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END \$\$;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 SET search_path='' AS \$\$ SELECT nullif(current_setting('qa.actor',true),'')::uuid \$\$;
 CREATE TABLE public.parishes(id uuid PRIMARY KEY,diocese_id uuid NOT NULL);
 INSERT INTO public.parishes VALUES('$P','$D'),('$P2','$D');
 CREATE TABLE public.user_profiles(auth_user_id uuid,parish_id uuid,diocese_id uuid,role text,is_active boolean,status text);
 INSERT INTO public.user_profiles VALUES('$A','$P','$D','parish',true,'ACTIVE'),
 ('$BAD','$P2','$D','parish',true,'ACTIVE');" >/dev/null
for t in pending_baptisms pending_confirmations pending_marriages pending_funerals; do
 run "CREATE TABLE public.$t(id uuid PRIMARY KEY,parish_id uuid,status text,
 reportado boolean,raw_data jsonb);" >/dev/null
done
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/qa-v252-ledger-memory-schema.sql >/dev/null
# V263 private attestation table only; no need to execute public writer DDL.
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "
 CREATE TABLE sacramentum_ledger.celebration_attestations_v263(
 pending_id uuid PRIMARY KEY,parish_id uuid,sacrament text,origin text,
 evidence_ref text,verified_at timestamptz,decree_effect text);" >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v264-parish-ledger-context.sql >/dev/null
eq "$(run "SELECT has_function_privilege('authenticated',
 'public.get_parish_ledger_seat_context_v264(uuid,text,jsonb)','EXECUTE')")" t
eq "$(run "SELECT has_function_privilege('anon',
 'public.get_parish_ledger_seat_context_v264(uuid,text,jsonb)','EXECUTE')")" f
run "INSERT INTO sacramentum_ledger.book_memories(
 id,parish_id,sacrament,book_type,book_code,first_folio,first_partida,
 partidas_per_folio,legacy_reconciled,active_count,version)
 VALUES('$B','$P','bautismo','ordinario','0001A',9,40,2,true,0,5);
 INSERT INTO public.pending_baptisms VALUES('$PD','$P','pending',false,'{}');
 INSERT INTO sacramentum_ledger.celebration_attestations_v263
 VALUES('$PD','$P','bautismo','new_sacrament','ACTA-REAL-FICTICIA',
 now(),NULL);" >/dev/null
call="SELECT public.get_parish_ledger_seat_context_v264('$P','bautismo',
 '[\"$PD\"]'::jsonb);"
reject "$call" "no session"
reject "SET qa.actor='$BAD'; $call" "foreign parish context"
v="$(run "SET qa.actor='$A'; $call")"
[[ "$v" == *'"code": "0001A"'* ]] || { echo "Expected literal book code: $v"; exit 1; }
[[ "$v" == *'"nextFolio": 9'* ]] || { echo "Expected first folio"; exit 1; }
[[ "$v" == *'"nextNumber": 40'* ]] || { echo "Expected first number"; exit 1; }
[[ "$v" == *'"verified": true'* ]] || { echo "Missing institution evidence"; exit 1; }
[[ "$v" == *'"pending": true'* ]] || { echo "Missing pending"; exit 1; }
reject "SET qa.actor='$A'; SELECT public.get_parish_ledger_seat_context_v264('$P2','bautismo','[]')" "cross tenant"
run "UPDATE public.pending_baptisms SET status='seated',reportado=true WHERE id='$PD'" >/dev/null
v="$(run "SET qa.actor='$A'; $call")"
[[ "$v" == *'"pending": false'* ]] || { echo "Seat was incorrectly still pending"; exit 1; }
run "UPDATE public.pending_baptisms SET status='pending',reportado=false WHERE id='$PD';
 DELETE FROM sacramentum_ledger.celebration_attestations_v263 WHERE pending_id='$PD'" >/dev/null
v="$(run "SET qa.actor='$A'; $call")"
[[ "$v" == *'"verified": false'* ]] || { echo "Missing evidence was accepted"; exit 1; }
echo "V264 PostgreSQL PASS: read-only per-parish context, explicit book pointer, evidence, state and anon denied."
