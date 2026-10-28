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
 baptism_id uuid,is_deceased boolean,death_date date,death_place text,
 linked_funeral_id uuid,
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
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/qa-v275-funeral-baptism-triggers.sql >/dev/null
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

# V275: Funeral -> existing same-parish Baptism must propagate deceased status
# with a physical marginal note. Rollback of mismatched links is mandatory.
BLINK="$(run "SELECT id FROM public.baptisms WHERE book_number='0001A'
 AND number='0001' AND nombres='PRUEBA'")"
F_BAD_NAME=26666666-0000-0000-0000-000000000001
F_BAD_OTHER=26666666-0000-0000-0000-000000000002
F_BAD_DATE=26666666-0000-0000-0000-000000000003
F_BAD_ALIAS=26666666-0000-0000-0000-000000000004
F_LINK=26666666-0000-0000-0000-000000000005
B_OTHER=26666666-0000-0000-0000-000000000099
run "INSERT INTO public.baptisms(id,parish_id,book_number,folio,number,
 celebration_date,nombres,apellidos,status,raw_data)
 VALUES('$B_OTHER','$P2','0009X','0001','0001',
 '2026-01-01','PRUEBA','FICTICIO','seated','{}'::jsonb);" >/dev/null
for spec in \
 "$F_BAD_NAME:OTRO:FICTICIO:2026-02-10:$BLINK" \
 "$F_BAD_OTHER:PRUEBA:FICTICIO:2026-02-10:$B_OTHER" \
 "$F_BAD_DATE:PRUEBA:FICTICIO:2025-12-31:$BLINK" \
 "$F_BAD_ALIAS:PRUEBA:FICTICIO:2026-02-10:$BLINK" \
 "$F_LINK:PRUEBA:FICTICIO:2026-02-10:$BLINK"; do
 IFS=: read -r fp fn fl fd bid <<< "$spec"
 run "INSERT INTO public.pending_funerals(id,parish_id,fecha_exequias,
 numero_registro,raw_data) VALUES('$fp','$P','2026-02-12','6',
 jsonb_build_object('nombres','$fn','apellidos','$fl',
 'fecha_defuncion','$fd','baptismRecordId','$bid'));" >/dev/null
 run "INSERT INTO sacramentum_ledger.celebration_attestations_v263(
 pending_id,parish_id,sacrament,origin,verified_at,verified_by,evidence_ref)
 VALUES('$fp','$P','exequias','new_sacrament',clock_timestamp(),
 '$A','ACTA-FUNERAL-BAPTISM-V275');" >/dev/null
done
run "UPDATE public.pending_funerals SET raw_data=raw_data||
 jsonb_build_object('baptism_record_id',
 '26666666-0000-0000-0000-000000000099') WHERE id='$F_BAD_ALIAS';" >/dev/null
linkedSeat(){ echo "SET qa.actor='$A'; SELECT public.seat_funeral_ledger_v263(
 '$P','$B4',1,1,2,'26666666-0000-0000-0000-0000000000$1',
 jsonb_build_array('$2'))"; }
reject "$(linkedSeat 11 "$F_BAD_NAME")" "funeral/baptism identity mismatch denied"
reject "$(linkedSeat 12 "$F_BAD_OTHER")" "cross-parish Baptism cannot be marked deceased"
reject "$(linkedSeat 13 "$F_BAD_DATE")" "death before Baptism denied"
reject "$(linkedSeat 14 "$F_BAD_ALIAS")" "ambiguous baptism reference denied"
eq "$(run "SELECT active_count FROM sacramentum_ledger.book_memories WHERE id='$B4'")" 1
eq "$(run "SELECT coalesce(is_deceased,false) FROM public.baptisms WHERE id='$BLINK'")" f
eq "$(run "SELECT count(*) FROM public.funerals WHERE baptism_id IS NOT NULL")" 0
run "$(linkedSeat 15 "$F_LINK")" >/dev/null
F_LINKED="$(run "SELECT id FROM public.funerals WHERE baptism_id='$BLINK'")"
[[ -n "$F_LINKED" ]] || { echo 'V275 did not set typed baptism link'; exit 1; }
eq "$(run "SELECT coalesce(is_deceased,false) FROM public.baptisms WHERE id='$BLINK'")" t
eq "$(run "SELECT death_date||':'||linked_funeral_id FROM public.baptisms
 WHERE id='$BLINK'")" "2026-02-10:$F_LINKED"
eq "$(run "SELECT count(*) FROM public.marginal_notes
 WHERE sacrament_id='$BLINK' AND note_type='defuncion' AND source_id='$F_LINKED'")" 1
eq "$(run "SELECT count(*) FROM public.registry_audit_log
 WHERE action='mark_deceased_from_funeral' AND entity_id='$BLINK'")" 1
[[ "$(run "SELECT nota_marginal FROM public.baptisms WHERE id='$BLINK'")" == *'EXEQUIAS REGISTRADAS EN LIBRO 0004D'* ]] || exit 1
eq "$(run "SELECT status||':'||reportado FROM public.pending_funerals WHERE id='$F_LINK'")" seated:true
echo "V275 PG16 PASS: Funeral typed baptism_id with two raw aliases, death and marginal note in same transaction, wrong person/parish/date/alias rollback."

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
eq "$(run "SELECT count(*) FROM sacramentum_ledger.seat_events")" 5
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
eq "$(run "SELECT count(*) FROM sacramentum_ledger.active_seats")" 5
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
eq "$(run "SELECT count(*) FROM sacramentum_ledger.active_seats")" 7

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

# V271: new supplementary decree is issued by chancery, independently
# approved by diocese and only THEN used for a manually opened physical book.
CH=00000000-0000-0000-0000-000000000040
DIO=00000000-0000-0000-0000-000000000041
CON=00000000-0000-0000-0000-000000000042
CHID=00000000-0000-0000-0000-000000000043
PMS=88888888-0000-0000-0000-000000000002
run "ALTER TABLE public.parishes ADD COLUMN is_operational boolean DEFAULT true;
 ALTER TABLE public.user_profiles ADD COLUMN chancery_id uuid;
 INSERT INTO public.user_profiles(auth_user_id,parish_id,diocese_id,role,is_active,status,chancery_id)
 VALUES('$CH',NULL,'$D','chancery',true,'ACTIVE','$CHID'),
 ('$DIO',NULL,'$D','diocese',true,'ACTIVE',NULL);
 CREATE TABLE public.chancelleries(id uuid PRIMARY KEY,diocese_id uuid);
 INSERT INTO public.chancelleries VALUES('$CHID','$D');
 CREATE TABLE public.dioceses(id uuid PRIMARY KEY);
 INSERT INTO public.dioceses VALUES('$D');
 CREATE TABLE public.conceptos_anulacion(
 id uuid PRIMARY KEY,diocese_id uuid,is_active boolean,seinscribe boolean,
 enlibro integer,tipo text,sacrament_type text,codigo text,concepto text,
 gennota boolean,gendocum boolean,expide text,source_kind text,source_reference text);
 INSERT INTO public.conceptos_anulacion VALUES
 ('$CON','$D',true,true,2,'porReposicion','matrimonio',
 'CON-REP-2026','REPOSICION MATRIMONIAL',true,true,
 'CANCILLERIA','manual','CONCEPTO-REVISADO');
 CREATE TABLE public.pending_creation_requests(
 parish_id uuid,sacrament_type text,response jsonb);
 CREATE TABLE public.decretos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),parish_id uuid,diocese_id uuid,
 chancery_id uuid,tipo text,sacrament_type text,decree_number text,
 decree_date date,status text,issued_by uuid,original_record_id uuid,
 replacement_record_id uuid,payload jsonb,
 CONSTRAINT chk_decretos_status CHECK(status IN('active','archived','cancelled','reversed')));
 CREATE FUNCTION public.qa_v271_decree_concept_snapshot() RETURNS trigger
 LANGUAGE plpgsql AS \$\$ BEGIN
 NEW.payload:=NEW.payload||jsonb_build_object('conceptPolicy',
 jsonb_build_object('bookMode',2,'registersEffect',true));
 RETURN NEW; END \$\$;
 CREATE TRIGGER trg_v271_concept_snapshot BEFORE INSERT ON public.decretos
 FOR EACH ROW EXECUTE FUNCTION public.qa_v271_decree_concept_snapshot();" >/dev/null
run "INSERT INTO public.pending_marriages(id,parish_id,celebration_date,raw_data)
 VALUES('$PMS','$P','2026-02-04',
 jsonb_build_object('numero','00000008','numeroRegistro','00000008',
 'fechaSacramento','2026-02-04','novioNombres','NOVIO','noviaNombres','NOVIA'));
 INSERT INTO public.pending_creation_requests VALUES('$P','matrimonio',
 jsonb_build_object('pending_id','$PMS'));" >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v272-authorize-supplementary-concept.sql >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v271-two-role-new-supplement-decrees.sql >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v272-next-supplementary-book.sql >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v271-first-supplementary-book.sql >/dev/null
issue(){ echo "SELECT public.issue_new_supplementary_decree_v271(
 '$P','matrimonio','$PMS','$CON','DEC-TEST-V271-001','2026-02-05',
 'MATRIMONIO PRUEBA','Reposición de registro de Matrimonio celebrado y no asentado',
 'ACTA-CELEBRACION-MATRIMONIO-001');"; }
reject "$(issue)" "not authenticated for decree"
reject "SET qa.actor='$A'; $(issue)" "parish cannot issue decree"
reject "SET qa.actor='$DIO'; $(issue)" "diocese cannot issue as chancery"
reject "SET qa.actor='$CH'; $(issue)" "chancery cannot issue without approved policy"
authorize(){ echo "SELECT public.approve_supplementary_concept_v272(
 '$CON','ACTA-DIOCESANA-CONCEPTO-2026');"; }
reject "SET qa.actor='$A'; $(authorize)" "parish cannot authorize concept"
reject "SET qa.actor='$CH'; $(authorize)" "chancery cannot authorize concept"
authResult="$(run "SET qa.actor='$DIO'; $(authorize)")"
[[ "$authResult" == *'"existing": false'* ]] || { echo "Concept authorization failed $authResult"; exit 1; }
authResult="$(run "SET qa.actor='$DIO'; $(authorize)")"
[[ "$authResult" == *'"existing": true'* ]] || { echo "Concept authorization idempotency failed"; exit 1; }
reject "SET qa.actor='$DIO'; SELECT public.approve_supplementary_concept_v272(
 '$CON','DIFFERENT-AUTH-REF-2026');" "cannot rewrite approval proof"
# Even with a fabricated V207 receipt, historical/imported boletas are denied.
PML=88888888-0000-0000-0000-000000000003
run "INSERT INTO public.pending_marriages(id,parish_id,celebration_date,raw_data)
 VALUES('$PML','$P','2026-02-04',
 jsonb_build_object('source','historical_import','numeroRegistro','9',
 'fechaSacramento','2026-02-04'));
 INSERT INTO public.pending_creation_requests VALUES('$P','matrimonio',
 jsonb_build_object('pending_id','$PML'));" >/dev/null
reject "SET qa.actor='$CH'; SELECT public.issue_new_supplementary_decree_v271(
 '$P','matrimonio','$PML','$CON','DEC-LEGACY-REJECT','2026-02-05',
 'MATRIMONIO PRUEBA','Fundamento documental de reposición indebida por importación',
 'ACTA-CELEBRACION-LEGACY');" "V271 historical import rejected"
decree="$(run "SET qa.actor='$CH'; $(issue)")"
[[ "$decree" == *'"pending_diocesan_review"'* ]] || { echo "V271 issuance failed $decree"; exit 1; }
DEC="$(run "SELECT id FROM public.decretos WHERE decree_number='DEC-TEST-V271-001'")"
reject "SET qa.actor='$CH'; $(issue)" "same decree number or pending ticket reused"
run "INSERT INTO public.decretos(parish_id,diocese_id,chancery_id,tipo,
 sacrament_type,decree_number,decree_date,status,issued_by,payload)
 VALUES('$P','$D','$CHID','documental','matrimonio',
 'DOC-ONLY-001','2026-02-05','active','$CH',
 jsonb_build_object('documentaryOnly',true,'recordOrigin','chancery_issue'));" >/dev/null
DOCID="$(run "SELECT id FROM public.decretos WHERE decree_number='DOC-ONLY-001'")"
reject "SET qa.actor='$DIO'; SELECT public.approve_new_supplementary_decree_v271(
 '$DOCID','REV-DOC-REJECT');" "documentary decree can never authorize supplementary seat"
eq "$(run "SELECT status FROM public.decretos WHERE id='$DEC'")" pending_diocesan_review
eq "$(run "SELECT count(*) FROM sacramentum_ledger.celebration_attestations_v263 WHERE pending_id='$PMS'")" 0
eq "$(run "SELECT count(*) FROM public.marriages WHERE book_type='suplementario'")" 0
approve(){ echo "SELECT public.approve_new_supplementary_decree_v271(
 '$DEC','REV-DIOCESANA-2026-001');"; }
reject "$(approve)" "no-session cannot approve"
reject "SET qa.actor='$CH'; $(approve)" "same issuer cannot approve"
reject "SET qa.actor='$A'; $(approve)" "parish cannot approve decree"
reject "SET qa.actor='$BAD'; $(approve)" "foreign parish cannot approve decree"
eq "$(run "SELECT status FROM public.decretos WHERE id='$DEC'")" pending_diocesan_review
openSupplement(){ echo "SELECT public.open_first_supplementary_book_v271(
 '$P','matrimonio','$PMS','SUP0001',1,1,2,false);"; }
reject "SET qa.actor='$A'; $(openSupplement)" "cannot open supplementary before diocese approval"
eq "$(run "SELECT count(*) FROM sacramentum_ledger.book_memories WHERE sacrament='matrimonio' AND book_type='suplementario'")" 0
approval="$(run "SET qa.actor='$DIO'; $(approve)")"
[[ "$approval" == *'"alreadyApproved": false'* ]] || { echo "Approval failed $approval"; exit 1; }
approval="$(run "SET qa.actor='$DIO'; $(approve)")"
[[ "$approval" == *'"alreadyApproved": true'* ]] || { echo "Approval idempotence failed $approval"; exit 1; }
eq "$(run "SELECT status FROM public.decretos WHERE id='$DEC'")" active
eq "$(run "SELECT origin||':'||decree_effect FROM sacramentum_ledger.celebration_attestations_v263 WHERE pending_id='$PMS'")" new_decree_supplement:create_supplementary_record
reject "SET qa.actor='$CH'; $(openSupplement)" "chancery cannot initialize parish supplementary book"
opened="$(run "SET qa.actor='$A'; $(openSupplement)")"
[[ "$opened" == *'"existing": false'* ]] || { echo "V271 supplementary book open failed $opened"; exit 1; }
SUPBOOK="$(run "SELECT id FROM sacramentum_ledger.book_memories WHERE parish_id='$P' AND sacrament='matrimonio' AND book_type='suplementario'")"
run "SET qa.actor='$A'; SELECT public.seat_marriage_ledger_v263(
 '$P','$SUPBOOK',0,1,1,'99999999-0000-0000-0000-000000000003',
 jsonb_build_array('$PMS'));" >/dev/null
eq "$(run "SELECT count(*) FROM public.marriages WHERE book_number='SUP0001'
 AND folio='0001' AND number='0001' AND book_type='suplementario'")" 1
eq "$(run "SELECT (raw_data->>'numeroRegistro')||':'||(raw_data->>'numero')
 FROM public.marriages WHERE book_number='SUP0001'")" '00000008:0001'
eq "$(run "SELECT count(*) FROM public.registry_audit_log WHERE action='approve_new_supplementary_decree_v271'")" 1
reject "SET qa.actor='$A'; $(openSupplement)" "cannot open duplicate after seat"
eq "$(run "SELECT count(*) FROM public.decretos WHERE status='pending_diocesan_review'")" 0

# V272: supplementary book succession must require a SECOND new approved
# supplementary decree, same parish and sacrament, with an active physical seat.
PMS2=88888888-0000-0000-0000-000000000004
run "INSERT INTO public.pending_marriages(id,parish_id,celebration_date,raw_data)
 VALUES('$PMS2','$P','2026-02-06',jsonb_build_object(
 'numero','00000009','numeroRegistro','00000009',
 'fechaSacramento','2026-02-06'));
 INSERT INTO public.pending_creation_requests VALUES('$P','matrimonio',
 jsonb_build_object('pending_id','$PMS2'));" >/dev/null
nextSup(){ echo "SELECT public.open_next_supplementary_book_v272(
 '$P','matrimonio','$SUPBOOK',1,'$PMS2','SUP0002',1,1,2,false,
 'ACTA-CIERRE-SUPLETORIO-001');"; }
reject "SET qa.actor='$A'; $(nextSup)" "no second decree cannot move supplementary book"
issue2(){ echo "SELECT public.issue_new_supplementary_decree_v271(
 '$P','matrimonio','$PMS2','$CON','DEC-TEST-V272-002','2026-02-07',
 'OTRO MATRIMONIO','Reposición de otro Matrimonio celebrado y no asentado',
 'ACTA-CELEBRACION-MATRIMONIO-002');"; }
run "SET qa.actor='$CH'; $(issue2)" >/dev/null
DEC2="$(run "SELECT id FROM public.decretos WHERE decree_number='DEC-TEST-V272-002'")"
reject "SET qa.actor='$A'; $(nextSup)" "issued but unapproved decree cannot close book"
run "SET qa.actor='$DIO'; SELECT public.approve_new_supplementary_decree_v271(
 '$DEC2','REV-DIOCESANA-2026-002');" >/dev/null
reject "SET qa.actor='$CH'; $(nextSup)" "chancery cannot close a parish book"
reject "SET qa.actor='$DIO'; $(nextSup)" "diocese cannot close a parish book"
reject "SET qa.actor='$A'; SELECT public.open_next_supplementary_book_v272(
 '$P','matrimonio','$SUPBOOK',0,'$PMS2','SUP0002',1,1,2,false,
 'ACTA-CIERRE-SUPLETORIO-001');" "stale expected version rejects successor"
nextOpened="$(run "SET qa.actor='$A'; $(nextSup)")"
[[ "$nextOpened" == *'"existing": false'* ]] || { echo "V272 successor did not open $nextOpened"; exit 1; }
SUPBOOK2="$(run "SELECT id FROM sacramentum_ledger.book_memories
 WHERE predecessor_book_id='$SUPBOOK'")"
[[ -n "$SUPBOOK2" ]] || { echo 'No supplementary successor memory' >&2; exit 1; }
eq "$(run "SELECT closed_at IS NOT NULL FROM sacramentum_ledger.book_memories WHERE id='$SUPBOOK'")" t
eq "$(run "SELECT count(*) FROM public.marriages WHERE book_number='SUP0001' AND number='0001'")" 1
eq "$(run "SELECT count(*) FROM public.registry_audit_log WHERE entity_type='official_book' AND action LIKE '%v272'")" 2
nextOpened="$(run "SET qa.actor='$A'; $(nextSup)")"
[[ "$nextOpened" == *'"existing": true'* ]] || { echo "V272 retry did not return same unseated successor"; exit 1; }
reject "SET qa.actor='$A'; SELECT public.seat_marriage_ledger_v263(
 '$P','$SUPBOOK',1,1,2,'99999999-0000-0000-0000-000000000004',
 jsonb_build_array('$PMS2'));" "closed supplementary book must reject seat"
run "SET qa.actor='$A'; SELECT public.seat_marriage_ledger_v263(
 '$P','$SUPBOOK2',0,1,1,'99999999-0000-0000-0000-000000000005',
 jsonb_build_array('$PMS2'));" >/dev/null
eq "$(run "SELECT count(*) FROM public.marriages WHERE book_number='SUP0002'
 AND number='0001' AND book_type='suplementario'")" 1
reject "SET qa.actor='$A'; $(nextSup)" "used successor cannot be reopened"
# A once-approved concept that changed policy must be rejected for NEW decrees.
run "UPDATE public.conceptos_anulacion SET concepto='REPOSICION MODIFICADA' WHERE id='$CON';" >/dev/null
PMS3=88888888-0000-0000-0000-000000000005
run "INSERT INTO public.pending_marriages(id,parish_id,celebration_date,raw_data)
 VALUES('$PMS3','$P','2026-02-09',
 jsonb_build_object('numero','00000010','numeroRegistro','00000010',
 'fechaSacramento','2026-02-09'));
 INSERT INTO public.pending_creation_requests VALUES('$P','matrimonio',
 jsonb_build_object('pending_id','$PMS3'));" >/dev/null
reject "SET qa.actor='$CH'; SELECT public.issue_new_supplementary_decree_v271(
 '$P','matrimonio','$PMS3','$CON','DEC-POLICY-DRIFT-003','2026-02-10',
 'MATRIMONIO DE PRUEBA','Una reposición que debe bloquearse tras cambiar política',
 'ACTA-CELEBRACION-MATRIMONIO-003');" "concept authorization fingerprint drift"
echo "V272 PG16 PASS: real documentary proof, separate diocesan concept authorization, 2nd active decree, independent 3-role controls, atomic supplementary succession, closed book protected, successor seat and stale policy rejected."

# No API execution while V263 is staged; separate cutting over grants is mandatory.
eq "$(run "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
 WHERE n.nspname='public' AND p.proname LIKE 'seat_%_ledger_v263'
 AND has_function_privilege('anon',p.oid,'EXECUTE')")" 0
echo "V263/V270/V271 PG16 PASS: four real physical asientos; closed-book successor; new decree with separate chancery/diocese approval; no early supplementary seat; historic and documentary rejected; field preservation, rollback and no premature client grants."
