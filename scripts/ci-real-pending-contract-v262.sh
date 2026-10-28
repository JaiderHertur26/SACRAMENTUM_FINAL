#!/usr/bin/env bash
# V262: real-shape pending adapters + institutional evidence; PG16 disposable.
set -Eeuo pipefail
: "${PG_CONTAINER:?isolated PG16 fixture}"
[[ "$PG_CONTAINER" =~ ^[A-Za-z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_real_pending_v262
pg createdb -U postgres "$db"
run(){ pg psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" | tr -d '\r'; }
reject(){ if run "$1" >/dev/null 2>&1; then echo "UNEXPECTED SUCCESS: $2" >&2; exit 1; fi; }
eq(){ [[ "$1" == "$2" ]] || { echo "expected [$2], got [$1]" >&2; exit 1; }; }
P=00000000-0000-0000-0000-000000000001
P2=00000000-0000-0000-0000-000000000002
ACTOR=00000000-0000-0000-0000-000000000030
run "CREATE TABLE public.parishes(id uuid PRIMARY KEY);
 INSERT INTO public.parishes VALUES('$P'),('$P2');" >/dev/null
for file in scripts/qa-v252-ledger-memory-schema.sql scripts/qa-v253-ledger-transactions.sql; do
 pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < "$file" >/dev/null
done
# The four pending structures mirror the real columns used by their RPCs.
for table in pending_baptisms pending_confirmations; do
 run "CREATE TABLE public.$table(
 id uuid PRIMARY KEY,parish_id uuid,status text DEFAULT 'pending',
 reportado boolean DEFAULT false,raw_data jsonb DEFAULT '{}'::jsonb);" >/dev/null
done
run "CREATE TABLE public.pending_marriages(
 id uuid PRIMARY KEY,parish_id uuid,status text DEFAULT 'pending',
 reportado boolean DEFAULT false,celebration_date date,book_type text DEFAULT 'ordinario',
 raw_data jsonb DEFAULT '{}'::jsonb);" >/dev/null
run "CREATE TABLE public.pending_funerals(
 id uuid PRIMARY KEY,parish_id uuid,status text DEFAULT 'pending',
 reportado boolean DEFAULT false,fecha_exequias date,numero_registro text,
 book_type text DEFAULT 'ordinario',raw_data jsonb DEFAULT '{}'::jsonb);" >/dev/null
for table in baptisms confirmations marriages funerals; do
 run "CREATE TABLE public.$table(id uuid PRIMARY KEY,parish_id uuid NOT NULL,
 book_number text NOT NULL,folio text NOT NULL,number text NOT NULL,
 book_type text NOT NULL,pending_id uuid UNIQUE);" >/dev/null
done
for file in scripts/qa-v259-atomic-physical-seat.sql scripts/qa-v262-real-pending-adapter.sql; do
 pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < "$file" >/dev/null
done
call(){ local kind="$1" book="$2" op="$3" pending="$4" parish="${5:-$P}"
 echo "SELECT sacramentum_ledger.qa_seat_real_pending_v262('$parish','$kind','$book',0,1,1,'$op','[\"$pending\"]'::jsonb,'$ACTOR');"
}
# Rows match current Supabase shapes: baptisms/confirmations use raw_data
# while marriage/funeral use a native celebration date.
B1=11111111-1111-1111-1111-111111111111
B2=22222222-2222-2222-2222-222222222222
B3=33333333-3333-3333-3333-333333333333
B4=44444444-4444-4444-4444-444444444444
PB=aaaaaaaa-1111-1111-1111-111111111111
PC=aaaaaaaa-2222-2222-2222-222222222222
PM=aaaaaaaa-3333-3333-3333-333333333333
PF=aaaaaaaa-4444-4444-4444-444444444444
run "INSERT INTO sacramentum_ledger.book_memories(
 id,parish_id,sacrament,book_type,book_code,first_folio,first_partida,
 partidas_per_folio,legacy_reconciled) VALUES
 ('$B1','$P','bautismo','ordinario','0001A',1,1,2,true),
 ('$B2','$P','confirmacion','ordinario','0002B',1,1,2,true),
 ('$B3','$P','matrimonio','ordinario','0003C',1,1,2,true),
 ('$B4','$P','exequias','ordinario','0004D',1,1,2,true);" >/dev/null
run "INSERT INTO public.pending_baptisms(id,parish_id,raw_data) VALUES
 ('$PB','$P','{\"fechaSacramento\":\"2024-10-01\",\"numeroRegistro\":\"1\"}'::jsonb);" >/dev/null
run "INSERT INTO public.pending_confirmations(id,parish_id,raw_data) VALUES
 ('$PC','$P','{\"celebration_date\":\"2024-10-02\",\"numeroRegistro\":\"2\"}'::jsonb);" >/dev/null
run "INSERT INTO public.pending_marriages(id,parish_id,celebration_date,raw_data) VALUES
 ('$PM','$P','2024-10-03','{\"numero_registro\":\"3\"}'::jsonb);" >/dev/null
run "INSERT INTO public.pending_funerals(id,parish_id,fecha_exequias,numero_registro) VALUES
 ('$PF','$P','2024-10-04','4');" >/dev/null
reject "$(call bautismo "$B1" 88888888-0000-0000-0000-000000000011 "$PB")" "missing attestation"
eq "$(run "SELECT count(*) FROM sacramentum_ledger.qa_pending_v259")" 0
run "INSERT INTO sacramentum_ledger.qa_celebration_evidence_v262(
 pending_id,parish_id,sacrament,origin,verified_at,verified_by,evidence_ref) VALUES
 ('$PB','$P','bautismo','historical_import',clock_timestamp(),'$ACTOR','ACTA-01'),
 ('$PC','$P','confirmacion','new_sacrament',clock_timestamp(),'$ACTOR','ACTA-02'),
 ('$PM','$P','matrimonio','new_sacrament',clock_timestamp(),'$ACTOR','ACTA-03'),
 ('$PF','$P','exequias','new_sacrament',clock_timestamp(),'$ACTOR','ACTA-04');" >/dev/null
reject "$(call bautismo "$B1" 88888888-0000-0000-0000-000000000012 "$PB")" "historical import with evidence does not seat"
reject "$(call confirmacion "$B2" 88888888-0000-0000-0000-000000000013 "$PC" "$P2")" "foreign tenant cannot seat"
reject "$(call matrimonio "$B3" 88888888-0000-0000-0000-000000000014 "$PM")" "wrong sacrament"
run "UPDATE sacramentum_ledger.qa_celebration_evidence_v262 SET origin='new_sacrament'
 WHERE pending_id='$PB';" >/dev/null

run "UPDATE public.pending_confirmations SET
 raw_data=raw_data||'{\"Libro\":\"0002B\"}'::jsonb WHERE id='$PC';" >/dev/null
reject "$(call confirmacion "$B2" 88888888-0000-0000-0000-000000000015 "$PC")" "preassigned coords"
run "UPDATE public.pending_confirmations SET raw_data=raw_data-'Libro' WHERE id='$PC';" >/dev/null

run "UPDATE public.pending_marriages SET celebration_date=current_date+1 WHERE id='$PM';" >/dev/null
reject "$(call matrimonio "$B3" 88888888-0000-0000-0000-000000000016 "$PM")" "future celebration"
run "UPDATE public.pending_marriages SET celebration_date='2024-10-03' WHERE id='$PM';" >/dev/null

# Simulate mid-transaction physical write failure; neither shadow, evidence,
# memory, real pending, nor event may be half-committed.
run "CREATE FUNCTION public.qa_v262_fail() RETURNS trigger LANGUAGE plpgsql
 AS \$\$ BEGIN RAISE EXCEPTION 'QA physical insert blocked'; END \$\$;
 CREATE TRIGGER qa_v262_fail BEFORE INSERT ON public.funerals
 FOR EACH ROW EXECUTE FUNCTION public.qa_v262_fail();" >/dev/null
reject "$(call exequias "$B4" 88888888-0000-0000-0000-000000000017 "$PF")" "physical transaction failure"
eq "$(run "SELECT count(*) FROM sacramentum_ledger.active_seats")" 0
eq "$(run "SELECT count(*) FROM sacramentum_ledger.qa_pending_v259")" 0
eq "$(run "SELECT status||':'||reportado FROM public.pending_funerals WHERE id='$PF'")" pending:false
run "DROP TRIGGER qa_v262_fail ON public.funerals;" >/dev/null

for packed in "bautismo:$B1:$PB:baptisms:1" "confirmacion:$B2:$PC:confirmations:2" "matrimonio:$B3:$PM:marriages:3" "exequias:$B4:$PF:funerals:4"; do
 IFS=: read -r kind book pending table num <<< "$packed"
 op="88888888-0000-0000-0000-00000000000$num"
 statement="$(call "$kind" "$book" "$op" "$pending")"
 response="$(run "$statement")"
 [[ "$response" == *'"after_count": 1'* ]] || { echo "No row seated: $kind $response"; exit 1; }
 eq "$(run "SELECT count(*) FROM public.$table WHERE pending_id='$pending'")" 1
 eq "$(run "SELECT status||':'||reportado FROM public.pending_$table WHERE id='$pending'")" seated:true
 eq "$(run "SELECT raw_data->>'record_id' FROM public.pending_$table WHERE id='$pending'")" "$(run "SELECT id FROM public.$table WHERE pending_id='$pending'")"
 eq "$(run "SELECT active_count||':'||version FROM sacramentum_ledger.book_memories WHERE id='$book'")" 1:1
 eq "$(run "$statement")" "$response"
 reject "$(call "$kind" "$book" "88888888-0000-0000-0000-00000000009$num" "$pending")" "cannot seat existing pending twice"
done
eq "$(run "SELECT count(*) FROM sacramentum_ledger.seat_events WHERE event_type='seat'")" 4
eq "$(run "SELECT count(*) FROM sacramentum_ledger.qa_seat_calls_v259")" 4
eq "$(run "SELECT count(*) FROM sacramentum_ledger.qa_pending_v259 WHERE status='seated'")" 4
echo "V262 PG16 PASS: four real pending schemas, institutional attestation, origin/tenant/date/preassigned guards, atomic rollback and idempotency."
