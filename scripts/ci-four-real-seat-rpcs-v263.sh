#!/usr/bin/env bash
# V263: production-shaped four real-table RPCs on disposable PostgreSQL16.
set -Eeuo pipefail
: "${PG_CONTAINER:?isolated PostgreSQL16 CI container required}"
[[ "$PG_CONTAINER" =~ ^[A-Za-z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_four_real_rpcs_v263
pg createdb -U postgres "$db"
run(){ pg psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" | tr -d '\r'; }
reject(){ if run "$1" >/dev/null 2>&1; then echo "UNEXPECTED SUCCESS: $2" >&2; exit 1; fi; }
eq(){ [[ "$1" == "$2" ]] || { echo "expected [$2], got [$1]" >&2; exit 1; }; }
P=00000000-0000-0000-0000-000000000001
P2=00000000-0000-0000-0000-000000000002
D=00000000-0000-0000-0000-000000000010
A=00000000-0000-0000-0000-000000000030
BAD=00000000-0000-0000-0000-000000000031
run "DO \$\$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
 CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles
 WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END \$\$;" >/dev/null
run "CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 SET search_path='' AS \$\$ SELECT nullif(current_setting('qa.actor',true),'')::uuid \$\$;
 CREATE TABLE public.parishes(id uuid PRIMARY KEY,diocese_id uuid NOT NULL);
 INSERT INTO public.parishes VALUES('$P','$D'),('$P2','$D');
 CREATE TABLE public.user_profiles(auth_user_id uuid,parish_id uuid,
 diocese_id uuid,role text,is_active boolean,status text);
 INSERT INTO public.user_profiles VALUES('$A','$P','$D','parish',true,'ACTIVE'),
 ('$BAD','$P2','$D','parish',true,'ACTIVE');" >/dev/null
for f in scripts/qa-v252-ledger-memory-schema.sql scripts/qa-v253-ledger-transactions.sql; do
 pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < "$f" >/dev/null
done
# Each actual pending table uses these common columns. Real source lacks some
# columns, but the V263 SQL only accesses source via safe to_jsonb keys.
for t in pending_baptisms pending_confirmations pending_marriages pending_funerals; do
 run "CREATE TABLE public.$t(
 id uuid PRIMARY KEY,parish_id uuid,status text DEFAULT 'pending',
 reportado boolean DEFAULT false,celebration_date date,fecha_exequias date,
 numero_registro text,raw_data jsonb DEFAULT '{}'::jsonb);" >/dev/null
done
# Physical record superset covers every field explicitly written by the four
# procedures, plus the typed date/time columns in original Sacramentum tables.
for t in baptisms confirmations marriages funerals; do
 run "CREATE TABLE public.$t(
 id uuid PRIMARY KEY,parish_id uuid,book_number text,folio text,number text,
 numero_registro text,status text,celebration_date date,
 apellidos text,nombres text,sexo text,lugar_bautismo text,lugar_nacimiento text,
 nombre_padre text,nombre_madre text,cedula_padre text,cedula_madre text,
 tipo_union_padres text,padrinos text,
 abuelos_paternos text,abuelos_maternos text,ministro text,da_fe text,
 nuip text,serial_registro text,oficina_registro text,direccion text,
 nota_marginal text,observations text,book_type text,document_id text,
 fecha_nacimiento date,fecha_bautismo date,fecha_expedicion_registro date,
 hora_sacramento text,fecha_defuncion date,lugar_defuncion text,
 fecha_exequias date,hora_exequias time,lugar_exequias text,
 cementerio text,causa_muerte text,conyuge text,
 raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,updated_at timestamptz DEFAULT now());" >/dev/null
done
run "CREATE TABLE public.marginal_notes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sacrament_type text,
 note_type text,content text,parish_id uuid,sacrament_id uuid,
 note_date date,source_type text,source_id uuid,created_by uuid,
 status text DEFAULT 'active');
 CREATE TABLE public.registry_audit_log(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_user_id uuid,
 parish_id uuid,diocese_id uuid,entity_type text,entity_id uuid,
 action text,after_data jsonb,metadata jsonb);" >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/qa-v269-linked-baptism-confirmation-triggers.sql >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v263-four-real-seat-rpcs.sql >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v267-first-official-book.sql >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v270-next-official-book.sql >/dev/null
eq "$(run "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'seat_%_ledger_v263'")" 4
eq "$(run "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'seat_%_ledger_v263'
 AND has_function_privilege('authenticated',p.oid,'EXECUTE')")" 0
run "SET qa.actor='$A'; SELECT auth.uid();" >/dev/null
B1=11111111-0000-0000-0000-000000000001
B2=11111111-0000-0000-0000-000000000002
B3=11111111-0000-0000-0000-000000000003
B4=11111111-0000-0000-0000-000000000004
PB=22222222-0000-0000-0000-000000000001
PC=22222222-0000-0000-0000-000000000002
PM=22222222-0000-0000-0000-000000000003
PF=22222222-0000-0000-0000-000000000004
REF=33333333-0000-0000-0000-000000000001
run "INSERT INTO sacramentum_ledger.book_memories(
 id,parish_id,sacrament,book_type,book_code,first_folio,first_partida,
 partidas_per_folio,legacy_reconciled) VALUES
 ('$B1','$P','bautismo','ordinario','0001A',1,1,2,true),
 ('$B2','$P','confirmacion','ordinario','0002B',1,1,2,true),
 ('$B3','$P','matrimonio','ordinario','0003C',1,1,2,true),
 ('$B4','$P','exequias','ordinario','0004D',1,1,2,true);" >/dev/null
run "INSERT INTO public.baptisms(id,parish_id,book_number,folio,number,
 nota_marginal,raw_data) VALUES('$REF','$P','0001A','0099','0999',
 'Nota anterior','{}'::jsonb);" >/dev/null
run "INSERT INTO public.pending_baptisms(id,parish_id,raw_data) VALUES
 ('$PB','$P','{\"fechaSacramento\":\"2026-01-01\",
 \"numeroRegistro\":\"1\",\"nombres\":\"PRUEBA\",\"apellidos\":\"FICTICIO\",
 \"nombrePadre\":\"PADRE\",\"nombreMadre\":\"MADRE\"}'::jsonb);" >/dev/null
run "INSERT INTO public.pending_confirmations(id,parish_id,raw_data) VALUES
 ('$PC','$P','{\"fechaSacramento\":\"2026-01-02\",
 \"numeroRegistro\":\"2\",\"nombres\":\"CONFIRMA\",\"apellidos\":\"PRUEBA\",
 \"cross_baptism_id\":\"$REF\"}'::jsonb);" >/dev/null
run "INSERT INTO public.pending_marriages(id,parish_id,celebration_date,raw_data) VALUES
 ('$PM','$P','2026-01-03',
 '{\"numero\":\"3\",\"numeroRegistro\":\"3\",\"observations\":\"Expediente de prueba\"}'::jsonb);" >/dev/null
run "INSERT INTO public.pending_funerals(id,parish_id,fecha_exequias,numero_registro,raw_data)
 VALUES('$PF','$P','2026-01-04','4',
 '{\"nombres\":\"DIFUNTO\",\"apellidos\":\"PRUEBA\",
 \"fecha_defuncion\":\"2026-01-03\",\"cementerio\":\"TEST\"}'::jsonb);" >/dev/null
for packed in "bautismo:$B1:$PB" "confirmacion:$B2:$PC" "matrimonio:$B3:$PM" "exequias:$B4:$PF"; do
 IFS=: read -r kind book pid <<< "$packed"
 run "INSERT INTO sacramentum_ledger.celebration_attestations_v263(
 pending_id,parish_id,sacrament,origin,verified_at,verified_by,evidence_ref)
 VALUES('$pid','$P','$kind','new_sacrament',clock_timestamp(),
 '$A','ACTA-FICTICIA-V263');" >/dev/null
done
call(){ local kind="$1" book="$2" pid="$3" op="$4" parish="${5:-$P}" actor="${6:-$A}"
 local f; case "$kind" in bautismo)f=seat_baptism_ledger_v263;;confirmacion)f=seat_confirmation_ledger_v263;;matrimonio)f=seat_marriage_ledger_v263;;exequias)f=seat_funeral_ledger_v263;;esac
 echo "SET qa.actor='$actor'; SELECT public.$f('$parish','$book',0,1,1,
 '$op','[\"$pid\"]'::jsonb);"
}
reject "$(call bautismo "$B1" "$PB" 44444444-0000-0000-0000-000000000011 "$P2")" "cross parish denied"
reject "$(call bautismo "$B1" "$PB" 44444444-0000-0000-0000-000000000012 "$P" "$BAD")" "wrong active role owner"
eq "$(run "SELECT count(*) FROM sacramentum_ledger.active_seats")" 0
for packed in "bautismo:$B1:$PB:baptisms:1" "confirmacion:$B2:$PC:confirmations:2" "matrimonio:$B3:$PM:marriages:3" "exequias:$B4:$PF:funerals:4"; do
 IFS=: read -r kind book pending table n <<< "$packed"
 op="44444444-0000-0000-0000-00000000000$n"
 statement="$(call "$kind" "$book" "$pending" "$op")"
 reply="$(run "$statement")"
 [[ "$reply" == *'"after_count": 1'* ]] || { echo "V263 FAILED $kind: $reply"; exit 1; }
 eq "$(run "SELECT count(*) FROM public.$table
  WHERE parish_id='$P' AND book_number IN ('0001A','0002B','0003C','0004D')
  AND folio='0001' AND number='0001'")" 1
 eq "$(run "SELECT active_count||':'||version FROM sacramentum_ledger.book_memories WHERE id='$book'")" 1:1
 case "$kind" in
  bautismo) ptable=pending_baptisms;;
  confirmacion) ptable=pending_confirmations;;
  matrimonio) ptable=pending_marriages;;
  exequias) ptable=pending_funerals;;
 esac
 eq "$(run "SELECT status||':'||reportado FROM public.$ptable WHERE id='$pending'")" seated:true
 eq "$(run "SELECT raw_data->>'record_id' FROM public.$ptable WHERE id='$pending'")" "$(run "SELECT id FROM public.$table WHERE parish_id='$P' AND folio='0001' AND number='0001'")"
 reject "$statement" "repeated operation cannot seat twice"
done
eq "$(run "SELECT count(*) FROM sacramentum_ledger.active_seats")" 4
eq "$(run "SELECT count(*) FROM public.registry_audit_log
 WHERE action='seat' AND parish_id='$P'")" 4
eq "$(run "SELECT count(*) FROM public.marginal_notes
 WHERE sacrament_id='$REF' AND source_type='confirmation'")" 1
[[ "$(run "SELECT nota_marginal FROM public.baptisms WHERE id='$REF'")" == *'Nota anterior'* ]] || exit 1
[[ "$(run "SELECT nota_marginal FROM public.baptisms WHERE id='$REF'")" == *'Confirmación asentada'* ]] || exit 1
eq "$(run "SELECT nombre_padre||':'||nombre_madre FROM public.baptisms WHERE nombres='PRUEBA'")" PADRE:MADRE
eq "$(run "SELECT observations FROM public.marriages WHERE book_number='0003C'")" "Expediente de prueba"
eq "$(run "SELECT cementerio FROM public.funerals WHERE book_number='0004D'")" TEST

# Audit failures must roll back an actual registry insert, pending transition,
# active ledger record, and its immutable seat event.
PX=55555555-0000-0000-0000-000000000001
run "INSERT INTO public.pending_marriages(id,parish_id,celebration_date,raw_data)
 VALUES('$PX','$P','2026-02-01','{\"numeroRegistro\":\"5\"}');
 INSERT INTO sacramentum_ledger.celebration_attestations_v263(
  pending_id,parish_id,sacrament,origin,verified_at,verified_by,evidence_ref)
 VALUES('$PX','$P','matrimonio','new_sacrament',clock_timestamp(),
 '$A','ACTA-RETROCESO-V263');" >/dev/null
run "CREATE FUNCTION public.qa_fail_audit_v263() RETURNS trigger
 LANGUAGE plpgsql AS \$\$ BEGIN RAISE EXCEPTION 'QA audit failure'; END \$\$;
 CREATE TRIGGER qa_fail_audit_v263 BEFORE INSERT ON public.registry_audit_log
 FOR EACH ROW EXECUTE FUNCTION public.qa_fail_audit_v263();" >/dev/null
reject "SET qa.actor='$A'; SELECT public.seat_marriage_ledger_v263('$P','$B3',1,1,2,
 '44444444-0000-0000-0000-000000000099','[\"$PX\"]'::jsonb);" "audit failure rolls everything back"
eq "$(run "SELECT active_count||':'||version FROM sacramentum_ledger.book_memories WHERE id='$B3'")" 1:1
eq "$(run "SELECT count(*) FROM public.marriages")" 1
eq "$(run "SELECT status||':'||reportado FROM public.pending_marriages WHERE id='$PX'")" pending:false
eq "$(run "SELECT count(*) FROM sacramentum_ledger.seat_events")" 4
run "DROP TRIGGER qa_fail_audit_v263 ON public.registry_audit_log;" >/dev/null

# V269: FULL REAL linked Baptism + Confirmation as a two-stage process.
# Live Supabase trigger copies the Baptism's actual record id, physical book
# folio and number into its pending Confirmation when Baptism is seated.
PB2=66666666-0000-0000-0000-000000000001
PC2=66666666-0000-0000-0000-000000000002
run "INSERT INTO public.pending_baptisms(id,parish_id,raw_data) VALUES
 ('$PB2','$P',jsonb_build_object('fechaSacramento','2026-05-01',
 'numeroRegistro','6','nombres','DOS','apellidos','SACRAMENTOS',
 'fechaNacimiento','2013-05-01','cedulaPadre','PADRE-001',
 'fechaExpedicionRegistro','2025-10-01','linkedConfirmationPendingId','$PC2'));
 INSERT INTO public.pending_confirmations(id,parish_id,raw_data) VALUES
 ('$PC2','$P',jsonb_build_object('fechaSacramento','2026-05-02',
 'numeroRegistro','7','nombres','DOS','apellidos','SACRAMENTOS',
 'linkedBaptismPendingId','$PB2','baptismReferencePending',true));
 INSERT INTO sacramentum_ledger.celebration_attestations_v263(
 pending_id,parish_id,sacrament,origin,verified_at,verified_by,evidence_ref)
 VALUES('$PB2','$P','bautismo','new_sacrament',clock_timestamp(),'$A','ACTA-BAUTISMO-COMBINADO'),
 ('$PC2','$P','confirmacion','new_sacrament',clock_timestamp(),'$A','ACTA-CONFIRMACION-COMBINADO');" >/dev/null
reject "SET qa.actor='$A'; SELECT public.seat_confirmation_ledger_v263(
 '$P','$B2',1,1,2,'77777777-0000-0000-0000-000000000001',
 jsonb_build_array('$PC2') );" "linked Confirmation cannot be seated BEFORE Baptism"
eq "$(run "SELECT count(*) FROM public.confirmations WHERE nombres='DOS'")" 0
eq "$(run "SELECT count(*) FROM sacramentum_ledger.active_seats")" 4
run "SET qa.actor='$A'; SELECT public.seat_baptism_ledger_v263(
 '$P','$B1',1,1,2,'77777777-0000-0000-0000-000000000002',
 jsonb_build_array('$PB2'));" >/dev/null
NEW_BAPTISM="$(run "SELECT raw_data->>'record_id' FROM public.pending_baptisms WHERE id='$PB2'")"
eq "$(run "SELECT raw_data->>'linkedBaptismRecordId' FROM public.pending_confirmations
 WHERE id='$PC2'")" "$NEW_BAPTISM"
eq "$(run "SELECT raw_data->>'numeroBautismo' FROM public.pending_confirmations
 WHERE id='$PC2'")" 0002
eq "$(run "SELECT cedula_padre||':'||fecha_expedicion_registro::text
 FROM public.baptisms WHERE id='$NEW_BAPTISM'")" PADRE-001:2025-10-01
run "SET qa.actor='$A'; SELECT public.seat_confirmation_ledger_v263(
 '$P','$B2',1,1,2,'77777777-0000-0000-0000-000000000003',
 jsonb_build_array('$PC2'));" >/dev/null
eq "$(run "SELECT count(*) FROM public.confirmations WHERE nombres='DOS' AND
 raw_data->>'linkedBaptismRecordId'='$NEW_BAPTISM'")" 1
eq "$(run "SELECT count(*) FROM public.marginal_notes WHERE sacrament_id='$NEW_BAPTISM'
 AND source_type='confirmation'")" 1
eq "$(run "SELECT count(*) FROM sacramentum_ledger.active_seats")" 6

# V270: atomic close of a used ordinary book + opening the NEXT book.
# The original physical rows must remain seated, with immutable closed pointer.
PN=88888888-0000-0000-0000-000000000001
run "INSERT INTO public.pending_baptisms(id,parish_id,raw_data) VALUES
 ('$PN','$P','{\"fechaSacramento\":\"2026-06-01\",\"numeroRegistro\":\"8\"}'::jsonb);
 INSERT INTO sacramentum_ledger.celebration_attestations_v263(
 pending_id,parish_id,sacrament,origin,verified_at,verified_by,evidence_ref)
 VALUES('$PN','$P','bautismo','new_sacrament',clock_timestamp(),
 '$A','ACTA-TERCER-BAUTISMO');" >/dev/null
nextCall(){ echo "SELECT public.open_next_official_book_v270(
 '$P','bautismo','$B1',2,'$PN','0005E',1,1,2,false,'ACTA-CIERRE-B-001');"; }
reject "$(nextCall)" "no session cannot close book"
reject "SET qa.actor='$BAD'; $(nextCall)" "foreign parish cannot close"
reject "SET qa.actor='$A'; SELECT public.open_next_official_book_v270(
 '$P','bautismo','$B1',1,'$PN','0005E',1,1,2,false,
 'ACTA-CIERRE-B-001');" "stale CAS denies closure"
reject "SET qa.actor='$A'; SELECT public.open_next_official_book_v270(
 '$P','bautismo','$B1',2,'$PN','0005E',1,1,2,false,
 'BAD');" "closure evidence too short"
eq "$(run "SELECT closed_at IS NULL FROM sacramentum_ledger.book_memories WHERE id='$B1'")" t
next="$(run "SET qa.actor='$A'; $(nextCall)")"
[[ "$next" == *'"existing": false'* ]] || { echo "V270 first successor missing $next"; exit 1; }
NBOOK="$(run "SELECT id FROM sacramentum_ledger.book_memories WHERE predecessor_book_id='$B1'")"
[[ -n "$NBOOK" ]] || exit 1
eq "$(run "SELECT closed_at IS NOT NULL FROM sacramentum_ledger.book_memories WHERE id='$B1'")" t
eq "$(run "SELECT active_count FROM sacramentum_ledger.book_memories WHERE id='$B1'")" 2
eq "$(run "SELECT count(*) FROM public.baptisms WHERE book_number='0001A'")" 3
eq "$(run "SELECT count(*) FROM sacramentum_ledger.book_memories WHERE predecessor_book_id='$B1'")" 1
eq "$(run "SELECT count(*) FROM public.registry_audit_log WHERE action LIKE '%v270'")" 2
next="$(run "SET qa.actor='$A'; $(nextCall)")"
[[ "$next" == *'"existing": true'* ]] || { echo "V270 idempotence failed $next"; exit 1; }
reject "SET qa.actor='$A'; SELECT public.seat_baptism_ledger_v263(
 '$P','$B1',2,2,3,'99999999-0000-0000-0000-000000000001',
 jsonb_build_array('$PN'));" "old book closed: writer rejected"
reject "SET qa.actor='$A'; SELECT public.open_first_official_book_v267(
 '$P','bautismo','$PN','0006F',1,1,2,false);" "first-book RPC must not open later book"
run "SET qa.actor='$A'; SELECT public.seat_baptism_ledger_v263(
 '$P','$NBOOK',0,1,1,'99999999-0000-0000-0000-000000000002',
 jsonb_build_array('$PN'));" >/dev/null
eq "$(run "SELECT count(*) FROM public.baptisms WHERE book_number='0005E' AND folio='0001' AND number='0001'")" 1
eq "$(run "SELECT active_count FROM sacramentum_ledger.book_memories WHERE id='$NBOOK'")" 1
reject "SET qa.actor='$A'; $(nextCall)" "cannot replay successor once it contains a seat"
eq "$(run "SELECT count(*) FROM public.registry_audit_log WHERE action LIKE '%v270'")" 2

# No API execution while V263 is staged; separate cutting over grants is mandatory.
eq "$(run "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
 WHERE n.nspname='public' AND p.proname LIKE 'seat_%_ledger_v263'
 AND has_function_privilege('anon',p.oid,'EXECUTE')")" 0
echo "V263 PG16 PASS: 4 real-table RPCs, original specific fields, confirmation cross-note, audit, rollback, multi-tenant and no client grants."
