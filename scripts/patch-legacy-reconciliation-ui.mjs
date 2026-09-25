import fs from 'node:fs';
const p='src/pages/admin/LegacyMigrationCenterPage.jsx';
let s=fs.readFileSync(p,'utf8');
const old=`<p className="text-sm text-slate-500 mt-1">{currentBatch.valid_count} válidos · {currentBatch.review_count} en revisión · {currentBatch.error_count} errores</p></div>`;
const neu=`<p className="text-sm text-slate-500 mt-1">{currentBatch.valid_count} válidos · {currentBatch.review_count} en revisión · {currentBatch.error_count} errores</p>{currentBatch.metadata?.reconciliation&&<div className="flex flex-wrap gap-2 mt-3 text-[9px] font-black uppercase"><span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700">Conciliados {currentBatch.metadata.reconciliation.matched||0}</span><span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">Sin coincidencia {currentBatch.metadata.reconciliation.unmatched||0}</span><span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Ambiguos {currentBatch.metadata.reconciliation.ambiguous||0}</span><span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700">Revisión {currentBatch.metadata.reconciliation.review||0}</span></div>}</div>`;
if(!s.includes(old)) throw new Error('Panel de lote no encontrado');
s=s.replace(old,neu);
fs.writeFileSync(p,s,'utf8');
console.log('PATCH_RECONCILIATION_UI_OK');
