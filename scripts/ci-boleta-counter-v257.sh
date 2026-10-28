#!/usr/bin/env bash
# V257 disposable PG16 functional and security test of staged V256 RPC.
set -Eeuo pipefail
: "${PG_CONTAINER:?requires isolated CI Postgres container}"
[[ "$PG_CONTAINER" =~ ^[A-Za-z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_counter_fixture_v257
pg createdb -U postgres "$db"
pg psql -X -v ON_ERROR_STOP=1 -q -U postgres -d "$db" -f - < scripts/qa-v257-counter-fixture.sql
pg psql -X -v ON_ERROR_STOP=1 -q -U postgres -d "$db" -f - < scripts/staged-v256-boleta-counter-rpc.sql

run(){ pg psql -X -v ON_ERROR_STOP=1 -A -t -q -U postgres -d "$db" -c "$1" | tr -d '\r'; }
P=00000000-0000-0000-0000-000000000101
P2=00000000-0000-0000-0000-000000000102
A=00000000-0000-0000-0000-000000000401
A2=00000000-0000-0000-0000-000000000402
as_auth(){
  local statement="$1" actor="${2:-$A}" scope="${3:-$P}" role="${4:-parish}"
  run "SET ROLE authenticated; SET request.jwt.claim.sub='$actor'; SET qa.app_parish='$scope'; SET qa.app_role='$role'; $statement"
}
call(){
  local sacrament="$1" expected="$2" next="$3" parish="${4:-$P}"
  echo "SELECT public.update_parish_boleta_counter_v256('$parish','$sacrament','$expected','$next')->>'numeroRegistroActual';"
}
reject(){ if "$@" >/dev/null 2>&1; then echo "UNEXPECTED SUCCESS: $*" >&2; exit 1; fi; }
assert_eq(){ [[ "$1" == "$2" ]] || { echo "expected [$2], got [$1]" >&2; exit 1; }; }

# Authenticated has EXECUTE but MUST have no direct table writes.
assert_eq "$(run "SELECT has_table_privilege('authenticated','public.parish_parameters','UPDATE')")" f
assert_eq "$(run "SELECT has_table_privilege('authenticated','public.parish_parameters','INSERT')")" f
assert_eq "$(run "SELECT has_table_privilege('authenticated','public.parish_parameters','DELETE')")" f
assert_eq "$(run "SELECT has_function_privilege('authenticated','public.update_parish_boleta_counter_v256(uuid,text,text,text)','EXECUTE')")" t
assert_eq "$(run "SELECT has_function_privilege('anon','public.update_parish_boleta_counter_v256(uuid,text,text,text)','EXECUTE')")" f

# Fail closed for owner, jurisdiction, wrong role, missing login, malformed values.
reject as_auth "$(call bautismo 000009 000015)" "$A2"
reject as_auth "$(call bautismo 000009 000015)" "$A" "$P2"
reject as_auth "$(call bautismo 000009 000015)" "$A" "$P" chancery
reject as_auth "$(call bautismo 000009 000015)" "00000000-0000-0000-0000-000000000499"
reject as_auth "$(call bautismo 000009 000015)" "$A" "$P" admin
reject as_auth "$(call unknown 000009 000015)"
reject as_auth "$(call bautismo 000009 '1a')"
reject as_auth "$(call bautismo 000009 000008)"
reject as_auth "$(call bautismo 000009 000009)"
reject as_auth "$(call bautismo 000009 000012)" # historical evidence already at 13
assert_eq "$(run "SELECT bautizos_params->>'numeroRegistroActual' FROM public.parish_parameters WHERE parish_id='$P'")" 000009
assert_eq "$(run "SELECT count(*) FROM public.registry_audit_log")" 0

# Authorized mutation does not alter fields or other sacramental counters.
assert_eq "$(as_auth "$(call bautismo 000009 000015)")" 000015
assert_eq "$(run "SELECT bautizos_params->>'ordinarioLibro' FROM public.parish_parameters WHERE parish_id='$P'")" 0001A
assert_eq "$(run "SELECT confirmaciones_params->>'numeroRegistroActual' FROM public.parish_parameters WHERE parish_id='$P'")" 000009
assert_eq "$(run "SELECT count(*) FROM public.registry_audit_log")" 1
assert_eq "$(run "SELECT (before_data->>'numeroRegistroActual')||'>'||(after_data->>'numeroRegistroActual') FROM public.registry_audit_log LIMIT 1")" "000009>000015"
reject as_auth "$(call bautismo 000009 000016)" # stale CAS
for sacrament in confirmacion matrimonio exequias; do
  if [[ "$sacrament" == matrimonio ]]; then old=00000009; new=00000010; else old=000009; new=000010; fi
  assert_eq "$(as_auth "SET qa.reject_baptism_update='yes'; $(call "$sacrament" "$old" "$new")")" "$new"
done
assert_eq "$(run "SELECT count(*) FROM public.registry_audit_log")" 4
assert_eq "$(run "SELECT bautizos_params->>'numeroRegistroActual' FROM public.parish_parameters WHERE parish_id='$P2'")" 000007

# Competing requests share old CAS. Only one succeeds, no double audit.
as_auth "$(call bautismo 000015 000016)" > /tmp/v257_a.txt 2>&1 &
pid1=$!
as_auth "$(call bautismo 000015 000017)" > /tmp/v257_b.txt 2>&1 &
pid2=$!
winners=0
if wait "$pid1"; then winners=$((winners+1)); fi
if wait "$pid2"; then winners=$((winners+1)); fi
assert_eq "$winners" 1
assert_eq "$(run "SELECT count(*) FROM public.registry_audit_log")" 5
current="$(run "SELECT bautizos_params->>'numeroRegistroActual' FROM public.parish_parameters WHERE parish_id='$P'")"
[[ "$current" == 000016 || "$current" == 000017 ]] || exit 1
next="$(printf '%06d' "$((10#$current+1))")"
# Audit insertion failure must roll back the parameter update in SAME transaction.
reject as_auth "SET qa.fail_audit='yes'; $(call bautismo "$current" "$next")"
assert_eq "$(run "SELECT bautizos_params->>'numeroRegistroActual' FROM public.parish_parameters WHERE parish_id='$P'")" "$current"
assert_eq "$(run "SELECT count(*) FROM public.registry_audit_log")" 5
echo "V257 isolated PostgreSQL RPC PASS: 4 sacraments, 2 parishes, ACL, tenant/role, CAS, race, rollback, audit."
