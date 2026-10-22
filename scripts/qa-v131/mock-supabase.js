const local='11111111-1111-4111-8111-111111111111';
const fixture=(id,s,n)=>({id,marriage_id:'33333333-3333-4333-8333-'+n.padStart(12,'0'),parish_id:'22222222-2222-4222-8222-222222222222',diocese_id:local,
decree_number:'QA-MATRIMONIO-'+n,decree_date:'2026-10-20',court_issuer:'Tribunal Eclesiástico Ficticio',
court_document_reference:'EXPEDIENTE-QA-'+n,court_document_date:'2026-10-19',court_document_sha256:'a'.repeat(64),
request_justification:'Expediente únicamente de laboratorio, sin personas ni sentencias reales.',
status:s,diocesan_review_note:s==='authorized'?'Revisión independiente ficticia con referencias simuladas.':null,decree_id:s==='executed'?'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa':null});
const rows=[fixture('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','pending_diocesan_review','101'),fixture('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb','authorized','102'),fixture('cccccccc-3333-4333-8333-cccccccccccc','executed','103')];
rows[0].court_document_sha256='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
window.__qaCalls=[];window.__qaRows=rows;
export const supabase={
rpc:async(name,args)=>{window.__qaCalls.push({name,args});if(name==='list_marriage_nullity_execution_v130')return{data:rows.filter(x=>!args?.p_status||x.status===args.p_status),error:null};
if(name==='review_marriage_nullity_execution_v128'){const item=rows.find(x=>x.id===args.p_authorization_id);if(!item)return{error:{message:'No encontrado'}};item.status=args.p_decision==='authorize'?'authorized':'rejected';item.diocesan_review_note=args.p_review_note;return{data:{status:item.status},error:null};}
if(name==='request_marriage_nullity_execution_v128'){const item=fixture(crypto.randomUUID(),'pending_diocesan_review','104');item.marriage_id=args.p_marriage_id;item.decree_number=args.p_decree_number;rows.unshift(item);return{data:item.id,error:null};}
if(name==='apply_marriage_nullity'){const item=rows.find(x=>x.id===args.p_decree_payload?.preExecutionAuthorizationId);if(!item||item.status!=='authorized')return{error:{message:'No autorizado'}};item.status='executed';item.decree_id=crypto.randomUUID();return{data:[{decree_id:item.decree_id,decree_number:item.decree_number}],error:null};}
return{data:null,error:{message:'RPC ficticia no implementada'}}},
from:()=>{const q={select:()=>q,in:()=>q,order:()=>q,limit:async()=>({data:[{id:'33333333-3333-4333-8333-000000000101',book_number:'12',folio:'37',number:'18',status:'seated'}],error:null})};return q;}
};