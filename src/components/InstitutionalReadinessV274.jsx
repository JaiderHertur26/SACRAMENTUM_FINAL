import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {AlertTriangle,RefreshCw,ShieldCheck} from 'lucide-react';
import {supabase} from '@/lib/supabaseClient';
import {Button} from '@/components/ui/button';

// Read-only, administrative preview. Only the server-side V267 cutover
// can prove release readiness; this UI never asserts that release is safe.
export default function InstitutionalReadinessV274(){
 const [value,setValue]=useState({loading:true,error:'',profiles:[],parishes:[],concepts:[]});
 const reload=useCallback(async()=>{
  setValue(v=>({...v,loading:true,error:''}));
  try{
   const responses=await Promise.all([
    supabase.from('user_profiles').select('id,role,is_active,status,auth_user_id,diocese_id,parish_id,chancery_id'),
    supabase.from('parishes').select('id,diocese_id,is_operational'),
    supabase.from('conceptos_anulacion').select('id,source_kind,tipo,enlibro,is_active')
   ]);
   const failed=responses.find(x=>x.error);
   if(failed)throw failed.error;
   setValue({loading:false,error:'',profiles:responses[0].data||[],
    parishes:responses[1].data||[],concepts:responses[2].data||[]});
  }catch(e){setValue({loading:false,error:e?.message||'Consulta no disponible',
    profiles:[],parishes:[],concepts:[]});}
 },[]);
 useEffect(()=>{reload();},[reload]);
 const stats=useMemo(()=>{
  const active=value.profiles.filter(x=>x.is_active===true&&String(x.status).toUpperCase()==='ACTIVE');
  const unbound=active.filter(x=>!x.auth_user_id);
  const roles={};
  unbound.forEach(x=>{const role=x.role||'sin rol';roles[role]=(roles[role]||0)+1;});
  const known=new Set();
  let dup=0;
  active.filter(x=>x.auth_user_id).forEach(x=>{
   if(known.has(x.auth_user_id))dup++;
   known.add(x.auth_user_id);
  });
  return {
   active:active.length,unbound:unbound.length,roles,duplicated:dup,
   inactiveParishes:value.parishes.filter(x=>x.is_operational!==true).length,
   supplementaryConcepts:value.concepts.filter(x=>x.source_kind==='manual'&&
     String(x.tipo).toLowerCase()==='porreposicion'&&x.enlibro===2&&x.is_active===true).length
  };
 },[value]);
 return <section aria-label="Estado de revisión institucional V274"
   className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
   <div className="flex flex-wrap justify-between items-start gap-4">
    <div className="flex items-start gap-3">
     <ShieldCheck className="h-6 w-6 mt-1 text-slate-700"/>
     <div>
      <h2 className="font-serif text-xl font-bold text-slate-950">Revisión institucional · V274</h2>
      <p className="text-sm text-slate-600">Inventario informativo. No crea usuarios ni altera partidas o permisos.</p>
     </div>
    </div>
    <Button type="button" variant="outline" disabled={value.loading} onClick={reload}>
     <RefreshCw className="w-4 h-4 mr-2"/>Actualizar
    </Button>
   </div>
   {value.loading?<p className="mt-5 text-sm" role="status">Consultando registros institucionales…</p>:
    value.error?<p className="mt-5 text-sm text-red-700" role="alert">
     No es posible verificar el inventario: {value.error}. La operación oficial no puede darse por autorizada.
    </p>:<>
     <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
      {[
       ['Perfiles activos visibles',stats.active],
       ['Sin cuenta Auth vinculada',stats.unbound],
       ['Parroquias no operativas',stats.inactiveParishes],
       ['Conceptos manuales elegibles',stats.supplementaryConcepts]
      ].map(([label,count])=><div key={label} className="rounded-xl border bg-slate-50 p-3">
       <p className="text-2xl font-black">{count}</p><p className="text-xs text-slate-600">{label}</p>
      </div>)}
     </div>
     {(stats.unbound>0||stats.duplicated>0)&&<div className="mt-4 flex gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-800"/>
      <div className="text-sm text-amber-950">
       <strong>Identidades pendientes de revisión.</strong> {stats.unbound} perfiles sin vínculo,
       {stats.duplicated} vínculos duplicados visibles.
       <p className="mt-1 text-xs">
        {Object.entries(stats.roles).map(([role,n])=>role+': '+n).join(' · ')}
       </p>
       <p className="mt-1 text-xs">Corresponde comprobar la identidad real, vincularla con seguridad o desactivar el perfil previa revisión. No se generan cuentas ficticias.</p>
      </div>
     </div>}
     <p className="mt-4 text-xs text-slate-500">
      Las políticas de acceso pueden limitar este inventario. Esta vista no certifica que una cuenta exista en Auth ni que las 26 tablas sean oficiales. Solo el control de base de datos V267–V274 decide la habilitación definitiva.
     </p>
    </>}
 </section>;
}
