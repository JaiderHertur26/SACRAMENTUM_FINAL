const records={
'doc-current':{id:'doc-current',parish_id:'parish-one',decree_number:'QA-V211-ACTUAL',decree_date:'2026-10-25',sacrament_type:'bautismo',tipo:'documental',status:'active',payload:{targetName:'PERSONA FICTICIA ACTUAL',reason:'DOCUMENTO DE PRUEBA',affectsSacramentalRecord:false}},
'doc-historical':{id:'doc-historical',parish_id:'parish-one',decree_number:'QA-V211-HISTORICO',decree_date:'2011-04-10',sacrament_type:'matrimonio',tipo:'documental',status:'archived',payload:{targetName:'PERSONA FICTICIA HISTORICA',reason:'FUENTE FICTICIA',historical:true,sourceReference:'LIBRO QA 9',affectsSacramentalRecord:false}},
'doc-foreign':{id:'doc-foreign',parish_id:'parish-other',decree_number:'QA-FOREIGN-NEVER-VISIBLE',decree_date:'2026-10-01',sacrament_type:'exequias',tipo:'documental',status:'active',payload:{targetName:'NO MOSTRAR PERSONA EXTERNA'}},
'baptism-current':{id:'baptism-current',parish_id:'parish-one',book_number:'31',folio:'0442',number:'0888',celebration_date:'2020-01-01',birth_date:'2019-01-01',nombres:'PERSONA',apellidos:'FICTICIA V211',status:'seated'},
'baptism-foreign':{id:'baptism-foreign',parish_id:'parish-other',book_number:'99',folio:'999',number:'999',nombres:'DATO',apellidos:'EXTERNO',status:'seated'}
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const supabase={
from(table){const q={};return{
select(){return this},eq(k,v){q[k]=v;return this},
async maybeSingle(){
 const id=String(q.id),scenario=window.__qa211.scenario;
 window.__qa211.calls.push({table,...q});await sleep(id.endsWith('delayed')?650:50);
 if((id==='doc-error'||id==='doc-retry')&&scenario!=='recovered')throw Error('PRIVATE INTERNAL DB ERROR DO NOT DISPLAY');
 if(id==='doc-rpc-error'||id==='doc-rpc-hang'||id==='doc-retry'||id==='doc-error'||id==='doc-delayed')return{data:{...records['doc-current'],id,decree_number:id==='doc-delayed'?'QA-STALE-OLD':'QA-V211-RECUPERADO'},error:null};
 if(id==='baptism-delayed')return{data:{...records['baptism-current'],id,nombres:'VIEJO'},error:null};
 const row=records[id];return{data:row?.parish_id===q.parish_id&&((table==='decretos'&&id.startsWith('doc-'))||(table==='baptisms'&&id.startsWith('baptism-')))?row:null,error:null};
}}},async rpc(name,args){window.__qa211.calls.push({rpc:name,record:args?.p_decree_id});if(args?.p_decree_id==='doc-rpc-error')throw Error('PRIVATE RPC ERROR');if(args?.p_decree_id==='doc-rpc-hang')return new Promise(()=>{});return{data:[{action:'issue_documentary_decree',created_at:'2026-10-25T12:00:00Z',actor_name:'CANCILLER QA',actor_role:'chancery'}],error:null}}
};