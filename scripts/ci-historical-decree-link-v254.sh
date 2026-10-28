#!/usr/bin/env bash
# V254: historic decree import links EXISTING physical book coordinates only.
# Disposable PostgreSQL 16 + fictitious UUIDs; never touches Supabase.
set -Eeuo pipefail
: "$PG_CONTAINER"
[[ "$PG_CONTAINER" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_ledger_fixture_v252
pg psql -v ON_ERROR_STOP=1 -q -U postgres -d "$db" -f - < scripts/qa-v254-link-existing-historical-decrees.sql >/dev/null
run(){ pg psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" | tr -d '\r'; }
reject(){ if run "$1" >/dev/null 2>&1; then echo "UNEXPECTED SUCCESS: $2" >&2; exit 1; fi; }
A='00000000-0000-0000-0000-000000000030'
P='00000000-0000-0000-0000-000000000001'
X='00000000-0000-0000-0000-000000000002'
D1='aaaaaaaa-1000-0000-0000-000000000001'
D2='aaaaaaaa-1000-0000-0000-000000000002'
D3='aaaaaaaa-1000-0000-0000-000000000003'
D4='aaaaaaaa-1000-0000-0000-000000000004'
D5='aaaaaaaa-1000-0000-0000-000000000005'
D6='aaaaaaaa-1000-0000-0000-000000000006'
before="$(run "SELECT coalesce(sum(active_count),0)::text||':'||(SELECT count(*) FROM sacramentum_ledger.active_seats)::text FROM sacramentum_ledger.book_memories")"
run "INSERT INTO public.parishes(id) VALUES('$X');
INSERT INTO sacramentum_ledger.historical_record_fixtures(id,parish_id,sacrament,book_code,folio,partida) VALUES
('bbbbbbbb-1000-0000-0000-000000000001','$P','bautismo','0001A','0005','0012'),
('bbbbbbbb-1000-0000-0000-000000000002','$P','bautismo','0002','0006','0013'),
('bbbbbbbb-1000-0000-0000-000000000003','$P','bautismo','0003','0007','0014'),
('bbbbbbbb-1000-0000-0000-000000000004','$P','bautismo','0003','7','14'),
('bbbbbbbb-1000-0000-0000-000000000005','$X','bautismo','0009','0003','0005'),
('bbbbbbbb-1000-0000-0000-000000000006','$P','bautismo','0010','0009','0005'),
('bbbbbbbb-1000-0000-0000-000000000007','$P','bautismo','0010','9','5');" >/dev/null
run "INSERT INTO sacramentum_ledger.historical_decree_fixtures(
id,parish_id,sacrament,source_verified,original_book,original_folio,original_partida,
replacement_book,replacement_folio,replacement_partida) VALUES
('$D1','$P','bautismo',true,'0001A','5','12','2','6','13'),
('$D2','$P','bautismo',true,'0003','7','14',NULL,NULL,NULL),
('$D3','$P','bautismo',true,'0004','8','17',NULL,NULL,NULL),
('$D4','$P','bautismo',false,'0001A','5','12',NULL,NULL,NULL),
('$D5','$P','bautismo',true,'0009','3','5',NULL,NULL,NULL),
('$D6','$P','bautismo',true,'0001A','5','12','0010','9','5')" >/dev/null
first="$(run "SELECT sacramentum_ledger.qa_link_historical_decree_v254('$D1','$A')")"
[[ "$first" == *'"action": "link_existing_decree"'* ]] || { echo "Original match failed"; exit 1; }
[[ "$first" == *'"consumeMemory": false'* ]] || { echo "Historical link consumed book memory"; exit 1; }
[[ "$(run "SELECT count(*) FROM sacramentum_ledger.historical_decree_link_events WHERE decree_id='$D1'")" == "1" ]]
again="$(run "SELECT sacramentum_ledger.qa_link_historical_decree_v254('$D1','$A')")"
[[ "$again" == *'"alreadyLinked": true'* ]] || { echo "Historical idempotency missing"; exit 1; }
[[ "$(run "SELECT count(*) FROM sacramentum_ledger.historical_decree_link_events WHERE decree_id='$D1'")" == "1" ]]
for decree in "$D2" "$D3" "$D5" "$D6"; do
 result="$(run "SELECT sacramentum_ledger.qa_link_historical_decree_v254('$decree','$A')")"
 [[ "$result" == *'"action": "review_required"'* ]] || { echo "Ambiguous/missing record was linked: $decree"; exit 1; }
done
reject "SELECT sacramentum_ledger.qa_link_historical_decree_v254('$D4','$A')" "unverified historical origin must be blocked"
[[ "$(run "SELECT count(*) FROM sacramentum_ledger.historical_decree_link_events")" == "1" ]]
[[ "$(run "SELECT count(*) FROM sacramentum_ledger.historical_decree_fixtures WHERE status='review_required'")" == "4" ]]
[[ "$(run "SELECT coalesce(sum(active_count),0)::text||':'||(SELECT count(*) FROM sacramentum_ledger.active_seats)::text FROM sacramentum_ledger.book_memories")" == "$before" ]] || { echo "Book memory changed during historical linking"; exit 1; }
reject "DELETE FROM sacramentum_ledger.historical_decree_link_events" "historical link history is immutable"
reject "UPDATE sacramentum_ledger.historical_decree_link_events SET actor_auth_id='$A'" "link audit cannot be rewritten"
echo "V254 PostgreSQL historical-link fixture PASS: unique source/replacement linked, ambiguous/missing quarantined, parish boundary, verification, idempotency, zero book memory consumption."
