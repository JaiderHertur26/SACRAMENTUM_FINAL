import {analyzeLegacyRow,detectLegacyProfile,extractLegacyRows} from '@/config/legacyImportProfiles';
const sleep=t=>new Promise(r=>setTimeout(r,t));
const all=[{id:'parish-A',name:'PARROQUIA FICTICIA A',city:'QA',diocese_id:'diocese-A'},{id:'parish-B',name:'PARROQUIA FICTICIA B',diocese_id:'diocese-B'}];
export const parseLegacyJsonFile=async file=>{
 if(file.name.includes('slow'))await sleep(350);else await sleep(20);
 const parsed=JSON.parse(await file.text()),rows=extractLegacyRows(parsed);
 const detected=detectLegacyProfile(file.name.replace(/-(slow|fast)/,''),rows);
 return{rows,profileKey:detected};
};
export const sha256File=async file=>'a'.repeat(64);
export const analyzeLegacyRows=(key,rows)=>rows.map((row,i)=>analyzeLegacyRow(key,row,i));
export const loadParishesForMigration=async dioceseId=>all.filter(p=>!dioceseId||p.diocese_id===dioceseId);
export const resolveLegacySourceScope=async({parishId,hash})=>parishId+'|'+hash;
export const listLegacyBatches=async()=>[];
export const createLegacyBatch=async data=>{const q=window.__qa212;q.created.push(data);q.batch={id:'qa-batch',profile_key:data.profileKey,parish_id:data.parishId,diocese_id:data.dioceseId,metadata:data.metadata,valid_count:2,review_count:0,error_count:0,status:'staged'};return q.batch.id};
export const stageLegacyRows=async(id,rows,chunk,onProgress,hash)=>{window.__qa212.staged.push({id,count:rows.length,hash});onProgress?.({staged:rows.length,total:rows.length});return rows.length};
export const getLegacyMigrationSummary=async()=>window.__qa212.batch;
export const applyLegacyBatch=async(id,opts)=>{window.__qa212.applied.push({id,profileKey:opts.profileKey});return window.__qa212.scenario==='stalled'?{imported:1,failed:0,remaining:1,stalled:true}: window.__qa212.scenario==='reported-review'?{imported:0,reconciled:1,reviewed:2,failed:0,remaining:0,stalled:false}: window.__qa212.scenario==='note-error'?{imported:0,reconciled:0,reviewed:0,failed:1,remaining:0,stalled:false}: {imported:2,reconciled:1,reviewed:0,failed:0,remaining:0,stalled:false,materialized:{materialized:2}}};
