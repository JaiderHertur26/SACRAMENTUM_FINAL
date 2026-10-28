#!/usr/bin/env bash
# V253: transaction, idempotence and concurrency tests in disposable PostgreSQL CI.
set -Eeuo pipefail
: "$PG_CONTAINER"
[[ "$PG_CONTAINER" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_ledger_fixture_v252
pg psql -v ON_ERROR_STOP=1 -q -U postgres -d "$db" -f - < scripts/qa-v253-ledger-transactions.sql >/dev/null
run(){ pg psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" | tr -d '\r'; }
reject(){ if run "$1" >/dev/null 2>&1; then echo "UNEXPECTED SUCCESS: $2" >&2; exit 1; fi; }

B='dddddddd-dddd-dddd-dddd-dddddddddddd'
A='00000000-0000-0000-0000-000000000030'
OP='aaaaaaaa-0000-0000-0000-000000000001'
data='[{"pending_id":"00000000-0000-0000-0000-000000000103","record_id":"00000000-0000-0000-0000-000000000203","celebration_date":"2024-01-03","registration_number":"20","verified":true},{"pending_id":"00000000-0000-0000-0000-000000000102","record_id":"00000000-0000-0000-0000-000000000202","celebration_date":"2024-01-02","registration_number":"3","verified":true},{"pending_id":"00000000-0000-0000-0000-000000000101","record_id":"00000000-0000-0000-0000-000000000201","celebration_date":"2024-01-03","registration_number":"11","verified":true}]'
run "INSERT INTO sacramentum_ledger.book_memories(id,parish_id,sacrament,book_type,book_code,first_folio,first_partida,partidas_per_folio) VALUES('$B','00000000-0000-0000-0000-000000000001','confirmacion','ordinario','0099B',1,1,2)" >/dev/null
sql="SELECT sacramentum_ledger.qa_append_batch_v253('$B',0,'$OP',1,1,'$data'::jsonb,'$A')"
reject "$sql" "unreconciled book may not seat"
run "UPDATE sacramentum_ledger.book_memories SET legacy_reconciled=true WHERE id='$B'" >/dev/null
reject "SELECT sacramentum_ledger.qa_append_batch_v253('$B',0,'$OP',1,2,'$data'::jsonb,'$A')" "wrong initial partida"
unverified='[{"pending_id":"00000000-0000-0000-0000-000000000113","record_id":"00000000-0000-0000-0000-000000000213","celebration_date":"2024-01-03","registration_number":"12","verified":false}]'
reject "SELECT sacramentum_ledger.qa_append_batch_v253('$B',0,'$OP',1,1,'$unverified'::jsonb,'$A')" "unverified celebration"
duplicate='[{"pending_id":"00000000-0000-0000-0000-000000000113","record_id":"00000000-0000-0000-0000-000000000213","celebration_date":"2024-01-03","registration_number":"0012","verified":true},{"pending_id":"00000000-0000-0000-0000-000000000114","record_id":"00000000-0000-0000-0000-000000000214","celebration_date":"2024-01-03","registration_number":"12","verified":true}]'
reject "SELECT sacramentum_ledger.qa_append_batch_v253('$B',0,'$OP',1,1,'$duplicate'::jsonb,'$A')" "duplicate registration number 0012/12"
[[ "$(run "SELECT active_count||':'||version FROM sacramentum_ledger.book_memories WHERE id='$B'")" == "0:0" ]]
result="$(run "$sql")"
[[ "$result" == *'"after_count": 3'* ]] || { echo "Failed batch result: $result"; exit 1; }
[[ "$(run "SELECT active_count||':'||version FROM sacramentum_ledger.book_memories WHERE id='$B'")" == "3:1" ]]
[[ "$(run "SELECT string_agg(lpad(folio::text,4,'0')||'/'||lpad(partida::text,4,'0'),',' ORDER BY ordinal) FROM sacramentum_ledger.active_seats WHERE book_id='$B'")" == "0001/0001,0001/0002,0002/0003" ]]
[[ "$(run "SELECT string_agg(pending_id::text,',' ORDER BY ordinal) FROM sacramentum_ledger.active_seats WHERE book_id='$B'")" == "00000000-0000-0000-0000-000000000102,00000000-0000-0000-0000-000000000101,00000000-0000-0000-0000-000000000103" ]]
[[ "$(run "$sql")" == "$result" ]] || { echo "Non-idempotent replay"; exit 1; }
[[ "$(run "SELECT count(*) FROM sacramentum_ledger.seat_events WHERE book_id='$B'")" == "3" ]]
reject "SELECT sacramentum_ledger.qa_append_batch_v253('$B',0,'$OP',1,1,'$unverified'::jsonb,'$A')" "replay with altered payload"
reject "SELECT sacramentum_ledger.qa_append_batch_v253('$B',0,'aaaaaaaa-0000-0000-0000-000000000002',1,1,'$data'::jsonb,'$A')" "stale version"
last="$(run "SELECT id::text FROM sacramentum_ledger.active_seats WHERE book_id='$B' AND ordinal=2")"
first="$(run "SELECT id::text FROM sacramentum_ledger.active_seats WHERE book_id='$B' AND ordinal=0")"
reverse="SELECT sacramentum_ledger.qa_reverse_tail_v253('$B',1,'aaaaaaaa-0000-0000-0000-000000000003','[\"$last\"]'::jsonb,'$A','Error de digitación','ACTA-QA-001')"
reject "SELECT sacramentum_ledger.qa_reverse_tail_v253('$B',1,'aaaaaaaa-0000-0000-0000-000000000003','[\"$first\"]'::jsonb,'$A','Error','ACTA')" "cannot reverse intermediate seat"
run "INSERT INTO sacramentum_ledger.seat_dependencies(seat_id,dependency_type,dependency_reference) VALUES('$last','certificate','00000000-0000-0000-0000-000000000777')" >/dev/null
reject "$reverse" "dependent certificate must block reversal"
run "DELETE FROM sacramentum_ledger.seat_dependencies WHERE seat_id='$last'" >/dev/null
revresult="$(run "$reverse")"
[[ "$revresult" == *'"after_count": 2'* ]] || { echo "Wrong reversal result"; exit 1; }
[[ "$(run "$reverse")" == "$revresult" ]] || { echo "Non-idempotent reversal"; exit 1; }
[[ "$(run "SELECT active_count||':'||version FROM sacramentum_ledger.book_memories WHERE id='$B'")" == "2:2" ]]
[[ "$(run "SELECT count(*) FROM sacramentum_ledger.seat_events WHERE book_id='$B'")" == "4" ]]
reject "SELECT sacramentum_ledger.qa_reverse_tail_v253('$B',2,'aaaaaaaa-0000-0000-0000-000000000004','[\"$first\"]'::jsonb,'$A','Erróneo','ACTA')" "nonterminal reversal even after previous reversal"

C='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
run "INSERT INTO sacramentum_ledger.book_memories(id,parish_id,sacrament,book_type,book_code,first_folio,first_partida,partidas_per_folio,legacy_reconciled) VALUES('$C','00000000-0000-0000-0000-000000000001','confirmacion','ordinario','0099C',1,1,3,true)" >/dev/null
one='[{"pending_id":"00000000-0000-0000-0000-000000000121","record_id":"00000000-0000-0000-0000-000000000221","celebration_date":"2024-01-01","registration_number":"22","verified":true}]'
two='[{"pending_id":"00000000-0000-0000-0000-000000000122","record_id":"00000000-0000-0000-0000-000000000222","celebration_date":"2024-01-01","registration_number":"23","verified":true}]'
run "SELECT sacramentum_ledger.qa_append_batch_v253('$C',0,'aaaaaaaa-0000-0000-0000-000000000021',1,1,'$one'::jsonb,'$A')" >/tmp/qa253_a.txt 2>&1 &
pid1=$!
run "SELECT sacramentum_ledger.qa_append_batch_v253('$C',0,'aaaaaaaa-0000-0000-0000-000000000022',1,1,'$two'::jsonb,'$A')" >/tmp/qa253_b.txt 2>&1 &
pid2=$!
winners=0
if wait "$pid1"; then winners=$((winners+1)); fi
if wait "$pid2"; then winners=$((winners+1)); fi
[[ "$winners" == "1" ]] || { echo "Concurrent race winner count: $winners"; cat /tmp/qa253_a.txt /tmp/qa253_b.txt; exit 1; }
[[ "$(run "SELECT active_count||':'||version FROM sacramentum_ledger.book_memories WHERE id='$C'")" == "1:1" ]]
[[ "$(run "SELECT count(*) FROM sacramentum_ledger.active_seats WHERE book_id='$C'")" == "1" ]]
echo "V253 PostgreSQL transaction fixture PASS: blocked unreviewed books, chronological batches, folio jumps, replay, dependencies, terminal reversal, concurrent winner 1/2, atomic rollback. No live Supabase."
