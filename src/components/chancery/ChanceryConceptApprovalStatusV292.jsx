import React,{useEffect,useState} from 'react';
import {checkChanceryDecreeConceptV292} from '@/services/issueDecreeFromFullFormV287';
import {Button} from '@/components/ui/button';

/** Informa el estado real de autorización, nunca otorga permisos ni autoriza. */
export default function ChanceryConceptApprovalStatusV292({
  conceptId,sacrament,type,onStatusChange
}){
  const [state,setState]=useState({loading:false,data:null,error:''});
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let alive=true;
    if(!conceptId){
      setState({loading:false,data:null,error:''});
      onStatusChange?.(false);
      return ()=>{alive=false;};
    }
    setState({loading:true,data:null,error:''});
    onStatusChange?.(false);
    checkChanceryDecreeConceptV292({conceptId,sacrament,type})
      .then(data=>{
        if(!alive)return;
        setState({loading:false,data,error:''});
        onStatusChange?.(data.approved===true);
      }).catch(error=>{
        if(!alive)return;
        setState({loading:false,data:null,error:error.message});
        onStatusChange?.(false);
      });
    return ()=>{alive=false;};
  },[conceptId,sacrament,type,revision]);
  if(!conceptId)return null;
  const approved=state.data?.approved===true;
  const bad=state.data?.status==='incompatible';
  return <section aria-label="Autorización del concepto de decreto" role="status"
    className={'mt-3 rounded-xl border p-4 text-xs leading-5 '+
      (approved?'border-emerald-200 bg-emerald-50 text-emerald-900':
        bad?'border-red-200 bg-red-50 text-red-900':
            'border-amber-200 bg-amber-50 text-amber-900')}>
    <p className="font-black">{approved?'Concepto autorizado para expedir el decreto':
      bad?'Concepto incompatible con partida supletoria':'Autorización diocesana requerida'}</p>
    <p className="mt-1">{state.loading?'Verificando autorización diocesana…':
      state.error||state.data?.message||'No se ha comprobado la autorización.'}</p>
    {!approved&&!state.loading&&<p className="mt-2 font-semibold">
      Un usuario autorizado del rol Diócesis debe entrar en
      «Archivo diocesano de decretos» → «Autorizar conceptos de corrección y reposición supletoria»,
      registrar la referencia documental y autorizar el concepto.
      Luego vuelva a este expediente y pulse «Comprobar autorización».
    </p>}
    <Button type="button" variant="outline" size="sm" className="mt-3"
      onClick={()=>setRevision(x=>x+1)} disabled={state.loading}>
      {state.loading?'Comprobando…':'Comprobar autorización'}
    </Button>
  </section>;
}
