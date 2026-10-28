#!/usr/bin/env bash
# V261: real PG16, private ledger with folio reset + atomic physical reverse.
set -Eeuo pipefail
: "${PG_CONTAINER:?disposable PostgreSQL 16 only}"
[[ "$PG_CONTAINER" =~ ^[A-Za-z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_folio_restart_v261
pg createdb -U postgres "$db"
run(){ pg psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" | tr -d '\r'; }
reject(){ if run "$1" >/dev/null 2>&1; then echo "UNEXPECTED SUCCESS: $2" >&2; exit 1; fi; }
eq(){ [[ "$1" == "$2" ]] || { echo "expected [$2] got [$1]" >&2; exit 1; }; }
P=00000000-0000-0000-0000-000000000001
A=00000000-0000-0000-0000-000000000030
B=77777777-0000-0000-0000-000000000001
OP=88888888-0000-0000-0000-000000000001
run "CREATE TABLE public.parishes(id uuid PRIMARY KEY); INSERT INTO public.parishes VALUES('$P')" >/dev/null
for file in scripts/qa-v252-ledger-memory-schema.sql scripts/qa-v253-ledger-transactions.sql; do
 pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < "$file" >/dev/null
done
for table in baptisms confirmations marriages funerals; do
 run "CREATE TABLE public.$table(id uuid PRIMARY KEY,parish_id uuid,book_number text,
  folio text,number text,book_type text,pending_id uuid UNIQUE);" >/dev/null
done
for file in scripts/qa-v259-atomic-physical-seat.sql scripts/qa-v261-physical-tail-reversal.sql; do
 pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < "$file" >/dev/null
done
run "INSERT INTO sacramentum_ledger.book_memories(
 id,parish_id,sacrament,book_type,book_code,first_folio,first_partida,
 partidas_per_folio,restart_partida_each_folio,legacy_reconciled)
 VALUES('$B','$P','bautismo','ordinario','0001A',8,50,2,true,true)" >/dev/null
for n in 1 2 3 4 5; do
 pid="99999999-0000-0000-0000-00000000000$n"
 run "INSERT INTO sacramentum_ledger.qa_pending_v259(
   id,parish_id,sacrament,celebration_date,registration_number,flow,verified)
 VALUES('$pid','$P','bautismo','2024-01-01','$n','new_sacrament',true)" >/dev/null
done
items='["99999999-0000-0000-0000-000000000001","99999999-0000-0000-0000-000000000002","99999999-0000-0000-0000-000000000003","99999999-0000-0000-0000-000000000004","99999999-0000-0000-0000-000000000005"]'
seat_sql="SELECT sacramentum_ledger.qa_atomic_seat_v259('$P','bautismo','$B',0,8,50,'$OP','$items'::jsonb,'$A');"
eq "$(run "SELECT restart_partida_each_folio::text FROM sacramentum_ledger.book_memories WHERE id='$B'")" true
result="$(run "$seat_sql")"
[[ "$result" == *'"after_count": 5'* ]] || { echo "seating failed: $result"; exit 1; }
eq "$(run "SELECT string_agg(lpad(folio::text,4,'0')||'/'||lpad(partida::text,4,'0'),',' ORDER BY ordinal)
 FROM sacramentum_ledger.active_seats WHERE book_id='$B'")" "0008/0050,0008/0051,0009/0001,0009/0002,0010/0001"
eq "$(run "SELECT string_agg(folio||'/'||number,',' ORDER BY folio::int,number::int) FROM public.baptisms WHERE parish_id='$P'")" "0008/0050,0008/0051,0009/0001,0009/0002,0010/0001"
eq "$(run "SELECT active_count||':'||version FROM sacramentum_ledger.book_memories WHERE id='$B'")" "5:1"
eq "$(run "$seat_sql")" "$result"
eq "$(run "SELECT count(*) FROM sacramentum_ledger.seat_events WHERE event_type='seat'")" 5
eq "$(run "SELECT count(*) FROM sacramentum_ledger.qa_pending_v259 WHERE status='seated'")" 5
last="$(run "SELECT id::text FROM sacramentum_ledger.active_seats WHERE book_id='$B' AND ordinal=4")"
middle="$(run "SELECT id::text FROM sacramentum_ledger.active_seats WHERE book_id='$B' AND ordinal=2")"
record="$(run "SELECT sacramental_record_id::text FROM sacramentum_ledger.active_seats WHERE id='$last'")"
reverse="SELECT sacramentum_ledger.qa_reverse_physical_tail_v261('$B',1,
 '88888888-0000-0000-0000-000000000002','[\"$last\"]'::jsonb,
 '$A','Registro erróneo','ACTA-V261-001');"
reject "SELECT sacramentum_ledger.qa_reverse_physical_tail_v261('$B',1,
 '88888888-0000-0000-0000-000000000003','[\"$middle\"]'::jsonb,
 '$A','No procede','ACTA-V261-002');" "middle seat cannot be reversed"
eq "$(run "SELECT active_count FROM sacramentum_ledger.book_memories WHERE id='$B'")" 5

# If external documents refer to the physical record, the physical delete
# refuses; the ledger reverse event + cursor MUST roll back in same transaction.
run "CREATE TABLE public.qa_v261_folio_rollback(
 doc_id uuid PRIMARY KEY, record_id uuid REFERENCES public.baptisms(id) ON DELETE RESTRICT
); INSERT INTO public.qa_v261_folio_rollback(doc_id,record_id) VALUES(
 'aaaaaaaa-0000-0000-0000-000000000001','$record');" >/dev/null
reject "$reverse" "physical foreign-key dependency must abort memory reverse"
eq "$(run "SELECT active_count||':'||version FROM sacramentum_ledger.book_memories WHERE id='$B'")" "5:1"
eq "$(run "SELECT count(*) FROM sacramentum_ledger.seat_events")" 5
eq "$(run "SELECT count(*) FROM public.baptisms")" 5
run "DELETE FROM public.qa_v261_folio_rollback WHERE record_id='$record'" >/dev/null

result="$(run "$reverse")"
[[ "$result" == *'"after_count": 4'* ]] || { echo "V261 reversal result: $result"; exit 1; }
eq "$(run "SELECT active_count||':'||version FROM sacramentum_ledger.book_memories WHERE id='$B'")" "4:2"
eq "$(run "SELECT count(*) FROM public.baptisms")" 4
eq "$(run "SELECT count(*) FROM sacramentum_ledger.active_seats")" 4
eq "$(run "SELECT count(*) FROM sacramentum_ledger.seat_events WHERE event_type='tail_reverse'")" 1
eq "$(run "SELECT count(*) FROM sacramentum_ledger.qa_pending_v259 WHERE status='pending'")" 1
reject "$reverse" "same reversal cannot silently delete twice"
reject "$seat_sql" "old seat receipt must not imply later physical seat is still active"
# After reverse, expected next slot is 0010/0001 (folio reset).
refill="SELECT sacramentum_ledger.qa_atomic_seat_v259('$P','bautismo','$B',2,10,1,
 '88888888-0000-0000-0000-000000000004',
 '[\"99999999-0000-0000-0000-000000000005\"]'::jsonb,'$A');"
result="$(run "$refill")"
[[ "$result" == *'"after_count": 5'* ]] || { echo "V261 tail refill: $result"; exit 1; }
eq "$(run "SELECT string_agg(folio||'/'||number,',' ORDER BY folio::int,number::int)
 FROM public.baptisms WHERE parish_id='$P'")" "0008/0050,0008/0051,0009/0001,0009/0002,0010/0001"
eq "$(run "SELECT count(*) FROM sacramentum_ledger.seat_events")" 7
echo "V261 PostgreSQL PASS: reset folio, physical 5-row batch, tail reversal, FK rollback, stale replay rejection, refill."
