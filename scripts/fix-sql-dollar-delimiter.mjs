import fs from 'node:fs';
const p='supabase/applied-history/SACRAMENTUM_LEGACY_IMPORT_RELATIONAL_V2.sql';
let s=fs.readFileSync(p,'utf8');
const bad='end;\n$;\nrevoke all on function public.reconcile_legacy_pre_registrations(text)';
const good='end;\n' + '$' + '$' + ';\nrevoke all on function public.reconcile_legacy_pre_registrations(text)';
if(!s.includes(bad)) throw new Error('Delimitador simple no encontrado');
s=s.split(bad).join(good);
fs.writeFileSync(p,s,'utf8');
console.log('SQL_DOLLAR_DELIMITER_FIXED');
