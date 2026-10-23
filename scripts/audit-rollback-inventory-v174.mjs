// V174 catalog of reversible database QA scripts. No database connection or mutation.
import fs from 'node:fs';
const files=fs.readdirSync('scripts').filter(x=>/^qa-rollback-.*\.sql$/.test(x)).sort();
const inventory=files.map(file=>{
 const sql=fs.readFileSync('scripts/'+file,'utf8');
 const begins=(sql.match(/^\s*BEGIN\s*;/gmi)||[]).length;
 const rollbacks=(sql.match(/^\s*ROLLBACK\s*;/gmi)||[]).length;
 const commits=(sql.match(/^\s*COMMIT\s*;/gmi)||[]).length;
 const unsafePattern=/\bpg_notify\b|\bpg_net\b|\bnet\.http_|\bdblink\b|\bhttp_get\b|\bhttp_post\b|\bcopy\s+.*\bprogram\b|\bcreate\s+extension\b|\bdrop\s+extension\b/i;
 const reversible=begins===1&&rollbacks===1&&commits===0&&/^\s*(?:--[^\n]*\n\s*)*BEGIN\s*;/i.test(sql)&&/ROLLBACK\s*;\s*$/.test(sql)&&!unsafePattern.test(sql);
 const historicBaseline=/-baseline-|-(?:repro|status-repro)-|two-later-notes-repro|stale-original-correction|stale-reposition-reversal|^qa-rollback-notification-read-spoof-v133\.sql$|^qa-rollback-nullity-without-preauthorization-v128\.sql$/.test(file);
 return {file,reversible,historicBaseline,bytes:sql.length,transactions:{begins,rollbacks,commits},externalOperations:unsafePattern.test(sql)};
});
const r={protocol:'V174',generatedAt:'2026-10-23',available:files.length,validReversible:inventory.filter(x=>x.reversible).length,baseline:inventory.filter(x=>x.historicBaseline).length,unqualified:inventory.filter(x=>!x.reversible),inventory};
fs.writeFileSync('AUDITORIA_INVENTARIO_SQL_V174.json',JSON.stringify(r,null,2)+'\n');
console.log('TOTAL='+r.available+' REVERSIBLE='+r.validReversible+' BASELINE='+r.baseline+' UNSAFE='+r.unqualified.length);
for(const e of inventory){console.log((e.reversible&&!e.historicBaseline?'CANDIDATE ':e.historicBaseline?'BASELINE  ':'REVIEW    ')+e.file)}
