// V273: stage all SECURITY DEFINER creates and their REVOKEs atomically.
// The frontend flag remains disabled, with final GRANTs deferred until V267.
import fs from 'node:fs';
const files=[
 'staged-v263-four-real-seat-rpcs.sql','staged-v264-parish-ledger-context.sql',
 'staged-v265-attest-new-celebration.sql','staged-v266-two-signature-physical-review.sql',
 'staged-v267-first-official-book.sql','staged-v270-next-official-book.sql',
 'staged-v271-two-role-new-supplement-decrees.sql','staged-v271-first-supplementary-book.sql',
 'staged-v272-authorize-supplementary-concept.sql','staged-v272-next-supplementary-book.sql',
 'staged-v273-institutional-master-review.sql'
];
for(const name of files) {
 const path='scripts/'+name;
 let sql=fs.readFileSync(path,'utf8').trimEnd();
 if(name==='staged-v264-parish-ledger-context.sql') {
  sql=sql.replace(
   `REVOKE ALL ON FUNCTION public.get_parish_ledger_seat_context_v264(uuid,text,jsonb)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_parish_ledger_seat_context_v264(uuid,text,jsonb)
 TO authenticated;`,
   `REVOKE ALL ON FUNCTION public.get_parish_ledger_seat_context_v264(uuid,text,jsonb)
 FROM PUBLIC,anon,authenticated;
-- No authenticated GRANT before the audited fresh-start V267 cutover.`);
 }
 if(name==='staged-v265-attest-new-celebration.sql') {
  sql=sql.replace(
   `REVOKE ALL ON FUNCTION public.attest_new_celebration_v265(uuid,text,uuid,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.attest_new_celebration_v265(uuid,text,uuid,text)
 TO authenticated;`,
   `REVOKE ALL ON FUNCTION public.attest_new_celebration_v265(uuid,text,uuid,text)
 FROM PUBLIC,anon,authenticated;
-- No authenticated GRANT before the audited fresh-start V267 cutover.`);
 }
 if(!/^BEGIN;\s/m.test(sql.slice(0,20)))sql='BEGIN;\n'+sql+'\nCOMMIT;';
 fs.writeFileSync(path,sql+'\n');
}
console.log('V273 atomic SECURITY DEFINER install files:',files.length);
