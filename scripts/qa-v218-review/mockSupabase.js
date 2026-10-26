const delay=async()=>{if(window.__qa218?.delay)await new Promise(r=>setTimeout(r,window.__qa218.delay));};
const all=Array.from({length:219},(_,n)=>({
 link_id:'qa-link-'+String(n).padStart(4,'0'),parish_id:'qa-parish',
 profile_key:n<46?'BAUTIZOS':'CONFIRMA',source_key:'QA-KEY-'+String(n+1).padStart(6,'0'),
 book_number:'9218',folio:String(Math.floor(n/5)+1),entry_number:String(n+1),
 target_id:'qa-missing-'+n,latest_decision:null,evidence_reference:null,reviewed_at:null
}));
export const supabase={rpc:async(name,args={})=>{
 window.__qa218.calls.push({name,args});
 await delay();
 if(window.__qa218.user.role!=='chancery')return{data:null,error:{message:'Acceso exclusivo de Cancillería'}};
 if(name==='summarize_unresolved_legacy_links_v218')return{data:window.__qa218.user.dioceseId==='diocese-A'?[{profile_key:'BAUTIZOS',unresolved:46,affected_parishes:1},{profile_key:'CONFIRMA',unresolved:173,affected_parishes:1}]:[],error:null};
 if(name==='list_unresolved_legacy_links_v218')return{data:window.__qa218.user.dioceseId==='diocese-A'?all.slice(args.p_offset,args.p_offset+args.p_limit):[],error:null};
 if(name==='record_unresolved_legacy_link_review_v218'){
   if(window.__qa218.user.dioceseId!=='diocese-A')return{data:null,error:{message:'Parroquia fuera de jurisdicción'}};
   window.__qa218.saved.push({...args});
   const row=all.find(x=>x.link_id===args.p_link_id);
   if(!row)return{data:null,error:{message:'Caso no localizado'}};
   row.latest_decision=args.p_decision;row.evidence_reference=args.p_evidence_reference;
   return{data:'qa-review-'+window.__qa218.saved.length,error:null};
 }
 return{data:null,error:{message:'Método no permitido'}};
}};