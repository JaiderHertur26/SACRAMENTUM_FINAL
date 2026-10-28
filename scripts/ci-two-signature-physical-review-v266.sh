#!/usr/bin/env bash
# V266 two-signature physical reconciliation; disposable PostgreSQL16 ONLY.
set -Eeuo pipefail
: "${PG_CONTAINER:?PG16 required}"
[[ "$PG_CONTAINER" =~ ^[A-Za-z0-9_-]+$ ]] || exit 2
pg(){ docker exec -e PGPASSWORD=ci_fixture_not_secret -i "$PG_CONTAINER" "$@"; }
db=sacramentum_physical_review_v266
pg createdb -U postgres "$db"
run(){ pg psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$db" -c "$1" | tr -d '\r'; }
reject(){ if run "$1" >/dev/null 2>&1; then echo "Unexpected success: $2" >&2; exit 1; fi; }
eq(){ [[ "$1" == "$2" ]] || { echo "Expected [$2] got [$1]" >&2; exit 1; }; }
P=00000000-0000-0000-0000-000000000001
D=00000000-0000-0000-0000-000000000010
PARISH=00000000-0000-0000-0000-000000000030
CHANCERY=00000000-0000-0000-0000-000000000031
BAD=00000000-0000-0000-0000-000000000032
run "DO \$\$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 END \$\$;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path=''
 AS \$\$ SELECT nullif(current_setting('qa.actor',true),'')::uuid \$\$;
 CREATE TABLE public.parishes(id uuid PRIMARY KEY,diocese_id uuid NOT NULL);
 INSERT INTO public.parishes VALUES('$P','$D');
 CREATE TABLE public.user_profiles(auth_user_id uuid,parish_id uuid,diocese_id uuid,
 role text,is_active boolean,status text);
 INSERT INTO public.user_profiles VALUES('$PARISH','$P','$D','parish',true,'ACTIVE'),
 ('$CHANCERY',NULL,'$D','chancery',true,'ACTIVE'),
 ('$BAD',NULL,'$D','admin_general',true,'ACTIVE');
 CREATE TABLE public.registry_audit_log(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_user_id uuid,parish_id uuid,diocese_id uuid,
 entity_type text,entity_id uuid,action text,after_data jsonb,metadata jsonb);
" >/dev/null
for t in baptisms confirmations marriages funerals; do
 run "CREATE TABLE public.$t(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 parish_id uuid NOT NULL,book_number text NOT NULL,folio text NOT NULL,
 number text NOT NULL,book_type text DEFAULT 'ordinario');" >/dev/null
done
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/qa-v252-ledger-memory-schema.sql >/dev/null
pg psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" -f - < scripts/staged-v266-two-signature-physical-review.sql >/dev/null
eq "$(run "SELECT has_function_privilege('authenticated',
'public.review_physical_book_v266(uuid,text,text,text,text,text,text,integer,integer,integer,boolean)','EXECUTE')")" f
eq "$(run "SELECT has_function_privilege('anon',
'public.review_physical_book_v266(uuid,text,text,text,text,text,text,integer,integer,integer,boolean)','EXECUTE')")" f
ID1=11111111-0000-0000-0000-000000000001
ID2=11111111-0000-0000-0000-000000000002
run "INSERT INTO public.baptisms(id,parish_id,book_number,folio,number)
 VALUES('$ID1','$P','0001A','0001','0001'),('$ID2','$P','0001A','0001','0002');" >/dev/null
REF='ACTA-FISICA-001'
NOTE='Libro físico cotejado contra dos asientos originales'
rpc(){ local act="$1" num="${2:-3}" ref="${3:-$REF}" note="${4:-$NOTE}"
 echo "SELECT public.review_physical_book_v266('$P','bautismo','ordinario',
 '0001A','$act','$ref','$note',2,$num,2,false);"
}
reject "$(rpc submit)" "unauthenticated proposal"
reject "SET qa.actor='$BAD'; $(rpc submit)" "admin_general cannot propose"
reject "SET qa.actor='$CHANCERY'; $(rpc submit)" "chancery cannot propose"
reject "SET qa.actor='$PARISH'; $(rpc approve)" "parish cannot approve its own proposal"
reply="$(run "SET qa.actor='$PARISH'; $(rpc submit)")"
[[ "$reply" == *'awaiting_institutional_countersign'* ]] || { echo "proposal missing: $reply" >&2; exit 1; }
eq "$(run "SELECT count(*) FROM sacramentum_ledger.book_memories")" 0
eq "$(run "SELECT count(*) FROM public.registry_audit_log")" 1
reject "SET qa.actor='$PARISH'; $(rpc submit)" "duplicate proposal rejected"
reject "SET qa.actor='$CHANCERY'; $(rpc approve 9)" "different physical coordinates rejected"
reject "SET qa.actor='$CHANCERY'; $(rpc approve 3 'ALTERED-ACTA-REF')" "different documentation rejected"
# Change ANY existing historical row coordinate after first signature;
# the snapshot digest must invalidate the second signature.
run "UPDATE public.baptisms SET number='0004' WHERE id='$ID2';" >/dev/null
reject "SET qa.actor='$CHANCERY'; $(rpc approve)" "stale physical snapshot rejected"
eq "$(run "SELECT count(*) FROM sacramentum_ledger.book_memories")" 0
run "UPDATE public.baptisms SET number='0002' WHERE id='$ID2';" >/dev/null
reply="$(run "SET qa.actor='$CHANCERY'; $(rpc approve)")"
[[ "$reply" == *'"status": "approved"'* ]] || { echo "approval missing: $reply" >&2; exit 1; }
eq "$(run "SELECT count(*) FROM sacramentum_ledger.book_memories
 WHERE parish_id='$P' AND sacrament='bautismo' AND book_code='0001A'
 AND legacy_reconciled=true AND first_folio=2 AND first_partida=3")" 1
eq "$(run "SELECT count(*) FROM public.registry_audit_log")" 2
eq "$(run "SELECT count(*) FROM sacramentum_ledger.physical_reviews_v266
 WHERE approved_by='$CHANCERY' AND submitted_by='$PARISH'")" 1
reject "SET qa.actor='$CHANCERY'; $(rpc approve)" "duplicate approval rejected"
# One-signer or interrupted audit may never create a book memory.
run "INSERT INTO public.confirmations(id,parish_id,book_number,folio,number)
 VALUES(gen_random_uuid(),'$P','0002A','0001','0001');" >/dev/null
run "CREATE FUNCTION public.qa_fail_review_audit_v266() RETURNS trigger LANGUAGE plpgsql
 AS \$\$ BEGIN RAISE EXCEPTION 'forced audit failure'; END \$\$;
 CREATE TRIGGER qa_fail_review_audit_v266 BEFORE INSERT ON public.registry_audit_log
 FOR EACH ROW EXECUTE FUNCTION public.qa_fail_review_audit_v266();" >/dev/null
reject "SET qa.actor='$PARISH'; SELECT public.review_physical_book_v266('$P','confirmacion',
'ordinario','0002A','submit','ACTA-FISICA-002','$NOTE',1,2,2,false);" "forced audit rollback"
eq "$(run "SELECT count(*) FROM sacramentum_ledger.physical_reviews_v266")" 1
eq "$(run "SELECT count(*) FROM sacramentum_ledger.book_memories")" 1
echo "V266 PG16 PASS: physical reconciliation requires parish signature, independent Chancery, stable snapshot, exact evidence, audit rollback and cannot auto-approve from digital records."
