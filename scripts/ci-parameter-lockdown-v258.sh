#!/usr/bin/env bash
# V258 irreversible permission choices tested ONLY in a throwaway PG16 cluster.
set -Eeuo pipefail
: "${PG_CONTAINER:?isolated CI postgres only}"
[[ "$PG_CONTAINER" =~ ^[A-Za-z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_acl_fixture_v258
pg createdb -U postgres "$db"
for file in scripts/qa-v257-counter-fixture.sql scripts/staged-v256-boleta-counter-rpc.sql scripts/qa-v258-lockdown-surface.sql; do
  pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < "$file" >/dev/null
done
run(){ pg psql -X -v ON_ERROR_STOP=1 -q -A -t -U postgres -d "$db" -c "$1" | tr -d '\r'; }
P=00000000-0000-0000-0000-000000000101
P2=00000000-0000-0000-0000-000000000102
A=00000000-0000-0000-0000-000000000401
as_auth(){
  run "SET ROLE authenticated; SET request.jwt.claim.sub='$A'; SET qa.app_parish='$P'; SET qa.app_role='parish'; $1"
}
reject(){ if "$@" >/dev/null 2>&1; then echo "UNEXPECTED SUCCESS: $*" >&2; exit 1; fi; }
eq(){ [[ "$1" == "$2" ]] || { echo "got [$1] expected [$2]" >&2; exit 1; }; }
before="$(run "SELECT has_table_privilege('authenticated','public.parish_parameters','UPDATE')")"
eq "$before" t
eq "$(run "SELECT has_function_privilege('authenticated','public.save_baptism_parameters(uuid,jsonb,integer,integer,integer)','EXECUTE')")" t

# Apply exactly the staged cutover SQL. Real permission changes are not made.
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v258-parameter-lockdown.sql >/dev/null

for action in INSERT UPDATE DELETE; do
  eq "$(run "SELECT has_table_privilege('authenticated','public.parish_parameters','$action')")" f
  eq "$(run "SELECT has_table_privilege('anon','public.parish_parameters','$action')")" f
done
eq "$(run "SELECT has_table_privilege('authenticated','public.parish_parameters','SELECT')")" t
for spec in "save_baptism_parameters(uuid,jsonb,integer,integer,integer)" \
  "save_confirmation_parameters(uuid,jsonb,integer,integer,integer)" \
  "save_marriage_parameters(uuid,jsonb,integer,integer,integer)" \
  "save_funeral_parameters(uuid,jsonb)"; do
  eq "$(run "SELECT has_function_privilege('authenticated','public.$spec','EXECUTE')")" f
  eq "$(run "SELECT has_function_privilege('anon','public.$spec','EXECUTE')")" f
done
for spec in "create_pending_baptism(uuid,jsonb)" "create_pending_confirmation(uuid,jsonb)" \
  "create_pending_marriage(uuid,jsonb)" "create_pending_funeral(uuid,jsonb)" \
  "seat_baptism_records(uuid,jsonb,integer,integer,integer)" \
  "seat_confirmation_records(uuid,jsonb,integer,integer,integer)" \
  "seat_pending_marriage(uuid)" "seat_funeral_record(jsonb,uuid)" \
  "update_parish_boleta_counter_v256(uuid,text,text,text)"; do
  eq "$(run "SELECT has_function_privilege('authenticated','public.$spec','EXECUTE')")" t
done
eq "$(run "SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='parish_parameters' AND cmd IN ('INSERT','UPDATE','DELETE')")" 0
eq "$(run "SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='parish_parameters' AND cmd='SELECT'")" 1

reject as_auth "UPDATE public.parish_parameters SET bautizos_params='{}'::jsonb WHERE parish_id='$P';"
reject as_auth "SELECT public.save_baptism_parameters('$P','{}'::jsonb,1,1,1);"
eq "$(as_auth "SELECT count(*) FROM public.parish_parameters;")" 1
eq "$(as_auth "SELECT count(*) FROM public.parish_parameters WHERE parish_id='$P2';")" 0

# The security-definer mock simulates an existing legitimate boleta RPC.
eq "$(as_auth "SELECT public.create_pending_baptism('$P','{}'::jsonb)->>'numeroRegistroActual';")" 000010
eq "$(run "SELECT bautizos_params->>'numeroRegistroActual' FROM public.parish_parameters WHERE parish_id='$P'")" 000010
eq "$(as_auth "SELECT public.update_parish_boleta_counter_v256('$P','bautismo','000010','000014')->>'numeroRegistroActual';")" 000014
eq "$(run "SELECT bautizos_params->>'ordinarioLibro' FROM public.parish_parameters WHERE parish_id='$P'")" 0001A
eq "$(run "SELECT bautizos_params->>'numeroRegistroActual' FROM public.parish_parameters WHERE parish_id='$P2'")" 000007
eq "$(run "SELECT count(*) FROM public.registry_audit_log")" 1
eq "$(as_auth "SELECT public.seat_pending_marriage('00000000-0000-0000-0000-000000000100')->>'not_a_value';")" ""
echo "V258 PG16 ACL PASS: old writes blocked, 8 actor RPCs preserved, 2 parishes isolated, counter atomic."
