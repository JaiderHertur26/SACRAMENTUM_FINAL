#!/usr/bin/env bash
set -Eeuo pipefail
: "$PG_CONTAINER"
[[ "$PG_CONTAINER" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_ledger_fixture_v252
pg psql -v ON_ERROR_STOP=1 -q -U postgres -d postgres -c "CREATE DATABASE $db" >/dev/null
pg psql -v ON_ERROR_STOP=1 -q -U postgres -d "$db" -c "CREATE TABLE public.parishes(id uuid PRIMARY KEY); INSERT INTO public.parishes VALUES ('00000000-0000-0000-0000-000000000001'); CREATE ROLE v252_fixture_reader NOLOGIN;" >/dev/null
pg psql -v ON_ERROR_STOP=1 -q -U postgres -d "$db" -f - < scripts/qa-v252-ledger-memory-schema.sql >/dev/null
run(){ pg psql -X -A -t -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" | tr -d '\r'; }
reject(){ if pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" >/dev/null 2>&1; then echo "UNEXPECTED ACCESS: $2" >&2; exit 1; fi; }
run "INSERT INTO sacramentum_ledger.book_memories(id,parish_id,sacrament,book_type,book_code,first_folio,first_partida,partidas_per_folio) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000001','bautismo','ordinario','0001A',1,1,3),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','00000000-0000-0000-0000-000000000001','bautismo','ordinario','0001',1,1,3)" >/dev/null
reject "INSERT INTO sacramentum_ledger.book_memories(parish_id,sacrament,book_type,book_code,first_folio,first_partida,partidas_per_folio) VALUES('00000000-0000-0000-0000-000000000001','bautismo','ordinario','1',1,1,3)" "normalized duplicate book 0001 vs 1"
[[ "$(run "SELECT book_code||':'||canonical_code FROM sacramentum_ledger.book_memories WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'")" == "0001A:0001A" ]]
run "UPDATE sacramentum_ledger.book_memories SET legacy_reconciled=true,first_seated_at=clock_timestamp(),active_count=1,version=1 WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'" >/dev/null
reject "UPDATE sacramentum_ledger.book_memories SET partidas_per_folio=2 WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'" "locked book configuration"
reject "UPDATE sacramentum_ledger.book_memories SET retired_at=clock_timestamp() WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'" "retire nonempty book"
run "INSERT INTO sacramentum_ledger.active_seats(book_id,ordinal,pending_id,sacramental_record_id,folio,partida,created_by_auth) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',0,'00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000020',1,1,'00000000-0000-0000-0000-000000000030')" >/dev/null
reject "INSERT INTO sacramentum_ledger.active_seats(book_id,ordinal,pending_id,sacramental_record_id,folio,partida,created_by_auth) VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',0,'00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000021',1,1,'00000000-0000-0000-0000-000000000030')" "duplicate ordinal"
reject "INSERT INTO sacramentum_ledger.seat_events(book_id,event_type,before_count,after_count,coordinates,actor_auth_id) VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','tail_reverse',1,0,'{}','00000000-0000-0000-0000-000000000030')" "reversal requires reason and authorization"
run "INSERT INTO sacramentum_ledger.seat_events(book_id,event_type,before_count,after_count,coordinates,actor_auth_id)
 VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','seat',0,1,'{}','00000000-0000-0000-0000-000000000030')" >/dev/null
reject "DELETE FROM sacramentum_ledger.seat_events" "immutable events"
reject "UPDATE sacramentum_ledger.seat_events SET coordinates='{}'" "immutable event modification"
reject "SET ROLE v252_fixture_reader; SELECT * FROM sacramentum_ledger.book_memories" "unauthorized schema read"
[[ "$(run "SELECT has_schema_privilege('v252_fixture_reader','sacramentum_ledger','USAGE')::text||':'||has_table_privilege('v252_fixture_reader','sacramentum_ledger.book_memories','INSERT')::text")" == "false:false" ]]
[[ "$(run "SELECT relrowsecurity::text FROM pg_class WHERE oid='sacramentum_ledger.book_memories'::regclass")" == "true" ]]
run "BEGIN; DELETE FROM sacramentum_ledger.active_seats WHERE book_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 INSERT INTO sacramentum_ledger.seat_events(book_id,event_type,before_count,after_count,coordinates,actor_auth_id,reason,authorization_reference)
 VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','tail_reverse',1,0,'{}','00000000-0000-0000-0000-000000000030','Error al asentar','QA-AUTORIZACION');
 UPDATE sacramentum_ledger.book_memories SET active_count=0,version=2,retired_at=clock_timestamp() WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 COMMIT;" >/dev/null
run "INSERT INTO sacramentum_ledger.book_memories(parish_id,sacrament,book_type,book_code,first_folio,first_partida,partidas_per_folio)
 VALUES('00000000-0000-0000-0000-000000000001','bautismo','ordinario','0001A',1,1,2)" >/dev/null
[[ "$(run "SELECT (SELECT count(*) FROM sacramentum_ledger.book_memories)::text||':'||(SELECT count(*) FROM sacramentum_ledger.seat_events)::text||':'||(SELECT count(*) FROM sacramentum_ledger.active_seats)::text")" == "3:2:0" ]]
echo "V252 PostgreSQL16 PRIVATE SCHEMA PASS: alphanumeric, duplicate keys, immutable config, reversal history, RLS, roles. No Supabase contacted."
