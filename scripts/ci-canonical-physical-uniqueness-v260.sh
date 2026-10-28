#!/usr/bin/env bash
# V260 disposable PG16: canonical physical-slot uniqueness, never live data.
set -Eeuo pipefail
: "${PG_CONTAINER:?isolated PG16 service required}"
[[ "$PG_CONTAINER" =~ ^[A-Za-z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_physical_unique_v260
pg createdb -U postgres "$db"
run(){ pg psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" | tr -d '\r'; }
reject(){ if run "$1" >/dev/null 2>&1; then echo "UNEXPECTED SUCCESS: $2" >&2; exit 1; fi; }
eq(){ [[ "$1" == "$2" ]] || { echo "expected [$2] got [$1]" >&2; exit 1; }; }
P=00000000-0000-0000-0000-000000000001
P2=00000000-0000-0000-0000-000000000002
for table in baptisms confirmations; do
 run "CREATE TABLE public.$table(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),parish_id uuid NOT NULL,book_number text,folio text,number text,status text)" >/dev/null
done
for table in marriages funerals; do
 run "CREATE TABLE public.$table(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),parish_id uuid NOT NULL,book_number text,folio text,number text,book_type text,status text)" >/dev/null
done
run "INSERT INTO public.baptisms(parish_id,book_number,folio,number,status) VALUES('$P','0001A','0001','0001','annulled')" >/dev/null
run "INSERT INTO public.confirmations(parish_id,book_number,folio,number,status) VALUES('$P','0001','0001','0001','seated')" >/dev/null
run "INSERT INTO public.marriages(parish_id,book_number,folio,number,book_type,status) VALUES('$P','0003B','0001','0001','ordinario','seated')" >/dev/null
run "INSERT INTO public.funerals(parish_id,book_number,folio,number,book_type,status) VALUES('$P','0004D','0001','0001','ordinario','seated')" >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v260-canonical-physical-uniqueness.sql >/dev/null
eq "$(run "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'uq_v260_%_physical_coordinates'")" 4
eq "$(run "SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND conname LIKE 'ck_v260_%_physical_coordinates' AND convalidated")" 4
reject "INSERT INTO public.baptisms(parish_id,book_number,folio,number) VALUES('$P','0001a','1','01')" "annulled original cannot be reused"
reject "INSERT INTO public.confirmations(parish_id,book_number,folio,number) VALUES('$P','1','00001','1')" "numerical code 0001 equals 1"
reject "INSERT INTO public.marriages(parish_id,book_number,folio,number,book_type) VALUES('$P','0003b','1','001','ordinario')" "alphanumeric marriage collision"
reject "INSERT INTO public.funerals(parish_id,book_number,folio,number,book_type) VALUES('$P','0004d','01','1','ordinario')" "funeral collision"
reject "INSERT INTO public.baptisms(parish_id,book_number,folio,number) VALUES('$P','A 01','1','1')" "spaces invalid"
reject "INSERT INTO public.baptisms(parish_id,book_number,folio,number) VALUES('$P','A01','0','1')" "zero folio invalid"
reject "INSERT INTO public.confirmations(parish_id,book_number,folio,number) VALUES('$P','A01',NULL,'1')" "NULL prohibited"
reject "INSERT INTO public.marriages(parish_id,book_number,folio,number,book_type) VALUES('$P','0003B','0001','0001',NULL)" "type required"
run "INSERT INTO public.baptisms(parish_id,book_number,folio,number,status) VALUES('$P2','0001a','1','1','seated')" >/dev/null
run "INSERT INTO public.confirmations(parish_id,book_number,folio,number,status) VALUES('$P','0001A','0001','0001','seated')" >/dev/null
run "INSERT INTO public.marriages(parish_id,book_number,folio,number,book_type) VALUES('$P','0003b','1','01','suplementario')" >/dev/null
eq "$(run "SELECT count(*) FROM public.marriages")" 2

# An entire multi-row statement rolls back on a late coordinate collision.
before="$(run "SELECT count(*) FROM public.funerals")"
reject "INSERT INTO public.funerals(parish_id,book_number,folio,number,book_type) VALUES('$P','NUEVO','1','1','ordinario'),('$P','0004D','01','001','ordinario')" "atomic multirow"
eq "$(run "SELECT count(*) FROM public.funerals")" "$before"

run "INSERT INTO public.funerals(parish_id,book_number,folio,number,book_type) VALUES('$P','CONCURR','1','1','ordinario')" >/tmp/v260_a.txt 2>&1 &
pid1=$!
run "INSERT INTO public.funerals(parish_id,book_number,folio,number,book_type) VALUES('$P','concurr','0001','0001','ordinario')" >/tmp/v260_b.txt 2>&1 &
pid2=$!
winners=0
if wait "$pid1"; then winners=$((winners+1)); fi
if wait "$pid2"; then winners=$((winners+1)); fi
eq "$winners" 1
# Pre-existing duplicates must abort the index creation, leaving no partial DDL.
bad=sacramentum_physical_duplicate_v260
pg createdb -U postgres "$bad"
for table in baptisms confirmations; do
 pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$bad" -c "CREATE TABLE public.$table(parish_id uuid,book_number text,folio text,number text)" >/dev/null
done
for table in marriages funerals; do
 pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$bad" -c "CREATE TABLE public.$table(parish_id uuid,book_number text,folio text,number text,book_type text)" >/dev/null
done
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$bad" -c "INSERT INTO public.baptisms VALUES('$P','0001A','0001','0001'),('$P','0001a','1','1')" >/dev/null
if pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$bad" -f - < scripts/staged-v260-canonical-physical-uniqueness.sql >/tmp/v260_duplicate.txt 2>&1; then
 echo "Duplicate fixture was incorrectly accepted" >&2
 exit 1
fi
eq "$(pg psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d "$bad" -c "SELECT count(*) FROM pg_indexes WHERE indexname LIKE 'uq_v260_%'" | tr -d '\r')" 0
eq "$(pg psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d "$bad" -c "SELECT count(*) FROM pg_constraint WHERE conname LIKE 'ck_v260_%'" | tr -d '\r')" 0
echo "V260 PG16 PASS: physical uniqueness 4 tables, race, annulled seat reserved, DDL atomicity."
