#!/usr/bin/env bash
# V265: isolated PostgreSQL16, no live Supabase mutations.
set -Eeuo pipefail
: "${PG_CONTAINER:?disposable PostgreSQL16 required}"
[[ "$PG_CONTAINER" =~ ^[A-Za-z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_creation_provenance_v265
pg createdb -U postgres "$db"
run(){ pg psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" | tr -d '\r'; }
reject(){ if run "$1" >/dev/null 2>&1; then echo "UNEXPECTED SUCCESS: $2" >&2; exit 1; fi; }
eq(){ [[ "$1" == "$2" ]] || { echo "EXPECTED [$2], GOT [$1]" >&2; exit 1; }; }
P=00000000-0000-0000-0000-000000000001
OTHER=00000000-0000-0000-0000-000000000002
D=00000000-0000-0000-0000-000000000010
A=00000000-0000-0000-0000-000000000030
BAD=00000000-0000-0000-0000-000000000031
BAPT=11111111-0000-0000-0000-000000000001
CONF=11111111-0000-0000-0000-000000000002
MARR=11111111-0000-0000-0000-000000000003
FUNE=11111111-0000-0000-0000-000000000004
LINKED=11111111-0000-0000-0000-000000000005
LEGACY=11111111-0000-0000-0000-000000000006
FUTURE=11111111-0000-0000-0000-000000000007
NOAUDIT=11111111-0000-0000-0000-000000000008
run "DO \$\$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 END \$\$;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path=''
  AS \$\$ SELECT nullif(current_setting('qa.actor',true),'')::uuid \$\$;
 CREATE TABLE public.parishes(id uuid PRIMARY KEY,diocese_id uuid);
 INSERT INTO public.parishes VALUES('$P','$D'),('$OTHER','$D');
 CREATE TABLE public.user_profiles(auth_user_id uuid,parish_id uuid,diocese_id uuid,
  role text,is_active boolean,status text);
 INSERT INTO public.user_profiles VALUES('$A','$P','$D','parish',true,'ACTIVE'),
 ('$BAD','$OTHER','$D','parish',true,'ACTIVE');" >/dev/null
for t in pending_baptisms pending_confirmations pending_marriages pending_funerals; do
 run "CREATE TABLE public.$t(id uuid PRIMARY KEY,parish_id uuid,status text DEFAULT 'pending',
    reportado boolean DEFAULT false,celebration_date date,fecha_exequias date,book_type text DEFAULT 'ordinario',
    raw_data jsonb DEFAULT '{}'::jsonb);" >/dev/null
done
run "CREATE TABLE public.pending_creation_requests(
 parish_id uuid,sacrament_type text,request_id uuid,payload_hash text,
 response jsonb,created_by uuid,created_at timestamptz DEFAULT now(),
 PRIMARY KEY(parish_id,sacrament_type,request_id));
 CREATE TABLE public.registry_audit_log(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_user_id uuid,
 parish_id uuid,diocese_id uuid,entity_type text,entity_id uuid,
 action text,after_data jsonb,metadata jsonb);" >/dev/null
run "CREATE SCHEMA sacramentum_ledger;
 CREATE TABLE sacramentum_ledger.celebration_attestations_v263(
 pending_id uuid PRIMARY KEY,parish_id uuid,sacrament text,
 origin text,verified_at timestamptz,verified_by uuid,evidence_ref text,
 decree_id uuid,decree_effect text);" >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v265-attest-new-celebration.sql >/dev/null
eq "$(run "SELECT has_function_privilege('anon',
 'public.attest_new_celebration_v265(uuid,text,uuid,text)','EXECUTE')")" f
eq "$(run "SELECT has_function_privilege('authenticated',
 'public.attest_new_celebration_v265(uuid,text,uuid,text)','EXECUTE')")" t
run "INSERT INTO public.pending_baptisms(id,parish_id,raw_data) VALUES
 ('$BAPT','$P','{\"fechaSacramento\":\"2026-01-01\"}'),
 ('$LEGACY','$P','{\"fechaSacramento\":\"2026-01-01\",\"source\":\"historical_import\"}'),
 ('$FUTURE','$P',jsonb_build_object('fechaSacramento',(current_date+1)::text)),
 ('$NOAUDIT','$P','{\"fechaSacramento\":\"2026-01-01\"}');
 INSERT INTO public.pending_confirmations(id,parish_id,raw_data) VALUES
 ('$CONF','$P','{\"fechaSacramento\":\"2026-01-02\"}'),
 ('$LINKED','$P','{\"fechaSacramento\":\"2026-01-02\"}');
 INSERT INTO public.pending_marriages(id,parish_id,celebration_date,raw_data)
 VALUES('$MARR','$P','2026-01-03',jsonb_build_object(
 'numero','00000003','numeroRegistro','00000003','fechaSacramento','2026-01-03'));
 INSERT INTO public.pending_funerals(id,parish_id,fecha_exequias) VALUES('$FUNE','$P','2026-01-04');" >/dev/null
run "INSERT INTO public.pending_creation_requests VALUES
 ('$P','bautismo','22222222-0000-0000-0000-000000000001','receipt1',
  jsonb_build_object('baptism_pending_id','$BAPT','confirmation_pending_id','$LINKED'),'$A',now()),
 ('$P','confirmacion','22222222-0000-0000-0000-000000000002','receipt2',
  jsonb_build_object('pending_id','$CONF'),'$A',now()),
 ('$P','matrimonio','22222222-0000-0000-0000-000000000003','receipt3',
  jsonb_build_object('pending_id','$MARR'),'$A',now()),
 ('$P','exequias','22222222-0000-0000-0000-000000000004','receipt4',
  jsonb_build_object('pending_id','$FUNE'),'$A',now()),
 ('$P','bautismo','22222222-0000-0000-0000-000000000005','receipt5',
  jsonb_build_object('baptism_pending_id','$FUTURE'),'$A',now()),
 ('$P','bautismo','22222222-0000-0000-0000-000000000006','receipt6',
  jsonb_build_object('baptism_pending_id','$NOAUDIT'),'$A',now());" >/dev/null
call(){ local kind="$1" pending="$2" ref="${3:-ACTA-PARROQUIAL-001}"
 echo "SELECT public.attest_new_celebration_v265('$P','$kind','$pending','$ref');"
}
reject "$(call bautismo "$BAPT")" "missing authentication"
reject "SET qa.actor='$BAD'; $(call bautismo "$BAPT")" "foreign parish identity"
reject "SET qa.actor='$A'; $(call bautismo "$LEGACY")" "legacy pending rejected"
reject "SET qa.actor='$A'; $(call bautismo "$FUTURE")" "future celebration rejected"
reject "SET qa.actor='$A'; $(call bautismo "$BAPT" 'BAD')" "short evidence rejected"
reject "SET qa.actor='$A'; $(call matrimonio "$BAPT")" "wrong sacrament rejected"
eq "$(run "SELECT count(*) FROM sacramentum_ledger.celebration_attestations_v263")" 0
for packed in "bautismo:$BAPT" "confirmacion:$CONF" "confirmacion:$LINKED" "matrimonio:$MARR" "exequias:$FUNE"; do
 IFS=: read -r kind pid <<< "$packed"
 statement="SET qa.actor='$A'; $(call "$kind" "$pid")"
 result="$(run "$statement")"
 [[ "$result" == *'"already_verified": false'* ]] || { echo "Expected first attestation: $kind $result"; exit 1; }
 result="$(run "$statement")"
 [[ "$result" == *'"already_verified": true'* ]] || { echo "Expected identical replay: $kind $result"; exit 1; }
 reject "SET qa.actor='$A'; $(call "$kind" "$pid" 'ACTA-PARROQUIAL-CHANGED')" "changed attestation rejected"
done
eq "$(run "SELECT count(*) FROM sacramentum_ledger.celebration_attestations_v263")" 5
eq "$(run "SELECT count(*) FROM public.registry_audit_log WHERE action='celebration_attested'")" 5
run "UPDATE public.pending_baptisms SET status='seated',reportado=true WHERE id='$BAPT';" >/dev/null
reject "SET qa.actor='$A'; $(call bautismo "$BAPT")" "already seated cannot reattest"
run "CREATE FUNCTION public.qa_fail_audit_v265() RETURNS trigger LANGUAGE plpgsql
 AS \$\$ BEGIN RAISE EXCEPTION 'forced audit failure'; END \$\$;
 CREATE TRIGGER qa_fail_audit_v265 BEFORE INSERT ON public.registry_audit_log
 FOR EACH ROW EXECUTE FUNCTION public.qa_fail_audit_v265();" >/dev/null
reject "SET qa.actor='$A'; $(call bautismo "$NOAUDIT")" "audit failure rolls back evidence"
eq "$(run "SELECT count(*) FROM sacramentum_ledger.celebration_attestations_v263 WHERE pending_id='$NOAUDIT'")" 0
eq "$(run "SELECT count(*) FROM public.registry_audit_log")" 5
echo "V265 PG16 PASS: 4 new-sacrament provenances, linked confirmation, parish auth, date, replay, audit rollback and no historical import."
