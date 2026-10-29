const fs=require('node:fs');
const text=fs.readFileSync('scripts/qa-v253-ledger-transactions.sql','utf8').replace(/\r\n/g,'\n');
const a=text.indexOf('CREATE FUNCTION sacramentum_ledger.qa_append_batch_v253(');
const b=text.indexOf('CREATE FUNCTION sacramentum_ledger.qa_reverse_tail_v253(',a);
if(a<0||b<0||b-a<5000)throw Error('V253 kernel not found exactly');
const kernel=text.slice(a,b).trim();
if(!kernel.endsWith('END $$;')||!kernel.includes('ORDER BY')||!kernel.includes('partidas_per_folio')||!kernel.includes('seat_operations'))throw Error('V253 kernel source unsafe');
const clone=kernel.replace('CREATE FUNCTION sacramentum_ledger.qa_append_batch_v253(','CREATE FUNCTION sacramentum_ledger.append_verified_batch_v281(');
const migration=`BEGIN;
-- V281 production repair: exact tested V253 append engine, moved into
-- a private, non-exposed, SECURITY INVOKER function without client EXECUTE.
-- The previously installed V263 real-seat called a missing QA function.
`+clone+`
REVOKE ALL ON FUNCTION sacramentum_ledger.append_verified_batch_v281(
 uuid,bigint,uuid,integer,integer,jsonb,uuid) FROM PUBLIC,anon,authenticated;
DO $rewrite$
DECLARE original text; modified text;
BEGIN
 SELECT pg_get_functiondef('sacramentum_ledger.real_seat_v263(
 uuid,text,uuid,bigint,integer,integer,uuid,jsonb)'::regprocedure) INTO original;
 IF original IS NULL OR
  (length(original)-length(replace(original,
    'sacramentum_ledger.qa_append_batch_v253(',
    '')))/length('sacramentum_ledger.qa_append_batch_v253(')<>1 THEN
  RAISE EXCEPTION 'V281: origen V263 incompatible con reparación verificable';
 END IF;
 modified:=replace(original,'sacramentum_ledger.qa_append_batch_v253(',
  'sacramentum_ledger.append_verified_batch_v281(');
 EXECUTE modified;
END $rewrite$;
DO $verify$
BEGIN
 IF to_regprocedure('sacramentum_ledger.append_verified_batch_v281(
 uuid,bigint,uuid,integer,integer,jsonb,uuid)') IS NULL OR
  position('append_verified_batch_v281(' IN pg_get_functiondef(
   'sacramentum_ledger.real_seat_v263(
 uuid,text,uuid,bigint,integer,integer,uuid,jsonb)'::regprocedure))=0 OR
  has_function_privilege('authenticated',
   'sacramentum_ledger.append_verified_batch_v281(uuid,bigint,uuid,integer,integer,jsonb,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'V281: motor privado no verificado'; END IF;
END $verify$;
COMMIT;
`;
fs.writeFileSync('scripts/v281-repair-real-ledger-kernel.sql',migration,'utf8');
console.log('V281 production kernel generated from reviewed V253 fixture; bytes '+migration.length);
