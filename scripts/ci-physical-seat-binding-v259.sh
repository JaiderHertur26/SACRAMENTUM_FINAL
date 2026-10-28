#!/usr/bin/env bash
# V259 four-sacrament atomic physical-seat proof on DISPOSABLE PostgreSQL 16 only.
set -Eeuo pipefail
: "${PG_CONTAINER:?must be isolated GitHub PG16 service}"
[[ "$PG_CONTAINER" =~ ^[A-Za-z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_four_physical_seats_v259
pg createdb -U postgres "$db"
run(){ pg psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" | tr -d '\r'; }
reject(){ if run "$1" >/dev/null 2>&1; then echo "UNEXPECTED SUCCESS: $2" >&2; exit 1; fi; }
eq(){ [[ "$1" == "$2" ]] || { echo "EXPECTED [$2] GOT [$1]" >&2; exit 1; }; }

run "CREATE TABLE public.parishes(id uuid PRIMARY KEY); INSERT INTO public.parishes VALUES('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');" >/dev/null
for sql in scripts/qa-v252-ledger-memory-schema.sql scripts/qa-v253-ledger-transactions.sql; do
  pg psql -X -v ON_ERROR_STOP=1 -q -U postgres -d "$db" -f - < "$sql" >/dev/null
done
for table in baptisms confirmations marriages funerals; do
  run "CREATE TABLE public.$table(
    id uuid PRIMARY KEY, parish_id uuid NOT NULL, book_number text NOT NULL,
    folio text NOT NULL, number text NOT NULL, book_type text NOT NULL,
    pending_id uuid UNIQUE);" >/dev/null
done
pg psql -X -v ON_ERROR_STOP=1 -q -U postgres -d "$db" -f - < scripts/qa-v259-atomic-physical-seat.sql >/dev/null

P=00000000-0000-0000-0000-000000000001
P2=00000000-0000-0000-0000-000000000002
A=00000000-0000-0000-0000-000000000030
B1=11111111-0000-0000-0000-000000000001
B2=11111111-0000-0000-0000-000000000002
B3=11111111-0000-0000-0000-000000000003
B4=11111111-0000-0000-0000-000000000004
BD=11111111-0000-0000-0000-000000000005
PB=22222222-0000-0000-0000-000000000001
PC=22222222-0000-0000-0000-000000000002
PM=22222222-0000-0000-0000-000000000003
PF=22222222-0000-0000-0000-000000000004
PD=22222222-0000-0000-0000-000000000005
OP=33333333-0000-0000-0000-000000000001
call(){ local sacrament="$1" book="$2" op="$3" pending="$4" parish="${5:-$P}" expected="${6:-0}" folio="${7:-1}" num="${8:-1}"
  echo "SELECT sacramentum_ledger.qa_atomic_seat_v259('$parish','$sacrament','$book',$expected,$folio,$num,'$op','[\"$pending\"]'::jsonb,'$A');"
}
run "INSERT INTO sacramentum_ledger.book_memories(id,parish_id,sacrament,book_type,book_code,first_folio,first_partida,partidas_per_folio,legacy_reconciled) VALUES
('$B1','$P','bautismo','ordinario','0001A',1,1,2,true),
('$B2','$P','confirmacion','ordinario','0002B',1,1,2,true),
('$B3','$P','matrimonio','ordinario','0003C',1,1,2,true),
('$B4','$P','exequias','ordinario','0004D',1,1,2,true),
('$BD','$P','bautismo','suplementario','DEC2026',6,20,2,true);" >/dev/null
run "INSERT INTO sacramentum_ledger.qa_pending_v259(
 id,parish_id,sacrament,celebration_date,registration_number,flow,verified)
 VALUES
('$PB','$P','bautismo','2024-01-01','0001','new_sacrament',true),
('$PC','$P','confirmacion','2024-01-02','0002','new_sacrament',true),
('$PM','$P','matrimonio','2024-01-03','0003','new_sacrament',true),
('$PF','$P','exequias','2024-01-04','0004','new_sacrament',true);" >/dev/null

# No historical, unverified, foreign, premature or malformed pending may seat.
run "INSERT INTO sacramentum_ledger.qa_pending_v259(
 id,parish_id,sacrament,celebration_date,registration_number,flow,verified)
 VALUES
('22222222-0000-0000-0000-000000000011','$P','bautismo','2021-01-01','11','historical_import',true),
('22222222-0000-0000-0000-000000000012','$P','bautismo','2024-01-01','12','new_sacrament',false),
('22222222-0000-0000-0000-000000000013','$P2','bautismo','2024-01-01','13','new_sacrament',true),
('22222222-0000-0000-0000-000000000014','$P','bautismo','2024-01-01','14','new_sacrament',true);" >/dev/null
reject "$(call bautismo "$B1" 33333333-0000-0000-0000-000000000011 22222222-0000-0000-0000-000000000011)" "historical archive"
reject "$(call bautismo "$B1" 33333333-0000-0000-0000-000000000012 22222222-0000-0000-0000-000000000012)" "unverified"
reject "$(call bautismo "$B1" 33333333-0000-0000-0000-000000000013 22222222-0000-0000-0000-000000000013)" "another parish"
reject "$(call bautismo "$B1" 33333333-0000-0000-0000-000000000014 "$PB" "$P2")" "foreign book scope"
reject "$(call confirmacion "$B1" 33333333-0000-0000-0000-000000000015 "$PB")" "wrong sacrament"
reject "SELECT sacramentum_ledger.qa_atomic_seat_v259('$P','bautismo','$B1',0,1,1,'33333333-0000-0000-0000-000000000016','[\"$PB\",\"$PB\"]'::jsonb,'$A')" "duplicate boleta"
eq "$(run "SELECT count(*) FROM sacramentum_ledger.active_seats")" 0

# Historic, physically documented record occupies the exact next slot.
run "INSERT INTO public.baptisms(id,parish_id,book_number,folio,number,book_type)
 VALUES('44444444-0000-0000-0000-000000000001','$P','0001A','00001','0001','ordinario')" >/dev/null
reject "$(call bautismo "$B1" "$OP" "$PB")" "physical coordinate already occupied"
eq "$(run "SELECT active_count FROM sacramentum_ledger.book_memories WHERE id='$B1'")" 0
eq "$(run "SELECT count(*) FROM sacramentum_ledger.seat_operations")" 0
run "DELETE FROM public.baptisms WHERE id='44444444-0000-0000-0000-000000000001'" >/dev/null

# Simulate failure DURING real registry insert: must roll back ledger/events/status.
run "CREATE FUNCTION public.qa_fail_physical_v259() RETURNS trigger
 LANGUAGE plpgsql AS \$\$ BEGIN
 IF current_setting('qa.fail_physical',true)='yes' THEN
   RAISE EXCEPTION 'QA physical insert failure';
 END IF; RETURN NEW; END \$\$;
 CREATE TRIGGER qa_fail_physical_v259 BEFORE INSERT ON public.marriages
 FOR EACH ROW EXECUTE FUNCTION public.qa_fail_physical_v259();" >/dev/null
reject "SET qa.fail_physical='yes'; $(call matrimonio "$B3" 33333333-0000-0000-0000-000000000003 "$PM")" "physical save failure"
eq "$(run "SELECT count(*) FROM sacramentum_ledger.seat_events")" 0
eq "$(run "SELECT count(*) FROM sacramentum_ledger.active_seats")" 0
eq "$(run "SELECT status FROM sacramentum_ledger.qa_pending_v259 WHERE id='$PM'")" pending

for packed in "bautismo:$B1:$PB:1" "confirmacion:$B2:$PC:2" "matrimonio:$B3:$PM:3" "exequias:$B4:$PF:4"; do
  IFS=: read -r kind book pending suffix <<< "$packed"
  op="33333333-0000-0000-0000-00000000000$suffix"
  response="$(run "$(call "$kind" "$book" "$op" "$pending")")"
  [[ "$response" == *'"after_count": 1'* ]] || { echo "No seat created: $kind"; exit 1; }
  table=; case "$kind" in bautismo)table=baptisms;;confirmacion)table=confirmations;;matrimonio)table=marriages;;exequias)table=funerals;;esac
  eq "$(run "SELECT count(*) FROM public.$table WHERE parish_id='$P'")" 1
  eq "$(run "SELECT status FROM sacramentum_ledger.qa_pending_v259 WHERE id='$pending'")" seated
  eq "$(run "SELECT active_count||':'||version FROM sacramentum_ledger.book_memories WHERE id='$book'")" 1:1
  eq "$(run "$(call "$kind" "$book" "$op" "$pending")")" "$response"
  reject "$(call "$kind" "$book" "33333333-0000-0000-0000-00000000009$suffix" "$pending")" "cannot seat twice"
done
eq "$(run "SELECT count(*) FROM sacramentum_ledger.active_seats")" 4
eq "$(run "SELECT count(*) FROM sacramentum_ledger.seat_events")" 4
eq "$(run "SELECT count(*) FROM sacramentum_ledger.qa_seat_calls_v259")" 4
reject "$(call bautismo "$B1" "$OP" "$PC")" "idempotency fingerprint mismatch"

# New decrees may seat ONLY in a supplementary book, never by import.
run "INSERT INTO sacramentum_ledger.qa_pending_v259(
 id,parish_id,sacrament,celebration_date,registration_number,flow,verified,
 decree_id,decree_effect) VALUES('$PD','$P','bautismo','2024-01-05','80',
 'new_decree_supplement',true,'55555555-0000-0000-0000-000000000001',
 'create_supplementary_record');" >/dev/null
reject "$(call bautismo "$B1" 33333333-0000-0000-0000-000000000020 "$PD" "$P" 1 1 2)" "decree in ordinary"
response="$(run "$(call bautismo "$BD" 33333333-0000-0000-0000-000000000021 "$PD" "$P" 0 6 20)")"
[[ "$response" == *'"after_count": 1'* ]] || exit 1
eq "$(run "SELECT folio||':'||number||':'||book_type FROM public.baptisms WHERE pending_id='$PD'")" 0006:0020:suplementario
eq "$(run "SELECT count(*) FROM sacramentum_ledger.qa_seat_calls_v259")" 5

echo "V259 PostgreSQL PASS: 4 physical sacramental tables, atomic ledger+record+pending, historical collision, multi-tenant, decree, replay, rollback."
