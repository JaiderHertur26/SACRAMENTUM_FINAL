// Disposable PostgreSQL fixture ONLY. Never use these synthetic signatures on Supabase.
import fs from 'node:fs';
const {preserve}=JSON.parse(fs.readFileSync('AUDITORIA_MATRIZ_RESET_V267_2026-10-28.json','utf8'));
if(preserve.length!==26)throw Error('V273 fixture master drift');
const arr='ARRAY['+preserve.map(t=>"'"+t+"'").join(',')+']::text[]';
const sql=`DO $fixture$
DECLARE
 v_t text;
 v_n bigint;
 v_hash text;
 v_all jsonb:='{}'::jsonb;
BEGIN
 FOREACH v_t IN ARRAY ${arr} LOOP
  EXECUTE format(
   'SELECT count(*),md5(coalesce(string_agg((%s)::text,''|'' ORDER BY (%s)::text),'''')) FROM public.%I v',
   CASE WHEN v_t='parishes' THEN 'to_jsonb(v)-''legacy_origin_id''' ELSE 'to_jsonb(v)' END,
   CASE WHEN v_t='parishes' THEN 'to_jsonb(v)-''legacy_origin_id''' ELSE 'to_jsonb(v)' END,v_t)
  INTO v_n,v_hash;
  v_all:=v_all||jsonb_build_object(v_t,jsonb_build_object('rows',v_n,'hash',v_hash));
  INSERT INTO sacramentum_ledger.master_review_v273(
   table_name,expected_rows,expected_md5,reviewed_by,approved_by,approval_reference)
  VALUES(v_t,v_n,v_hash,'QA_REVIEWER_A','QA_APPROVER_B','FIXTURE-APPROVAL-NOT-OFFICIAL');
 END LOOP;
 UPDATE sacramentum_ledger.purge_receipts_v268 SET retained_counts=v_all WHERE id=true;
END $fixture$;`;
process.stdout.write(sql+'\n');
