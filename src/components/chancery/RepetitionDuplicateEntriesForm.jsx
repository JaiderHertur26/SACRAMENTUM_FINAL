import React from 'react';
import { CanonicalField, CanonicalSectionTitle, canonicalInputClass, canonicalSelectClass, canonicalTextareaClass } from '@/components/chancery/CanonicalDecreePrimitives';
import { REPETITION_DISPOSITIONS } from '@/utils/repetitionCaseV314.mjs';

const emptyEntry=()=>({parishId:'',parishName:'',external:false,externalJurisdiction:'',book:'',folio:'',number:'',recordId:'',disposition:'investigate',justification:''});

export default function RepetitionDuplicateEntriesForm({entries=[],onChange,parishes=[]}) {
 const update=(index,key,value)=>{
   onChange(entries.map((item,i)=>i!==index?item:{
     ...item,[key]:value,...(key==='parishId'?value==='__external__'?{
       parishId:'',external:true,parishName:'',recordId:''
     }:{external:false,parishName:parishes.find(p=>p.id===value)?.name||''}:{})
   }));
 };
 return <section className="space-y-4">
   <CanonicalSectionTitle title="Partidas relacionadas (mínimo dos)"
     subtitle="Cada inscripción conserva Libro, Folio y Número originales. Una misma parroquia puede custodiar varias partidas; también pueden intervenir parroquias diferentes."/>
   <p className="text-xs leading-relaxed text-amber-900 rounded-lg border border-amber-200 bg-amber-50 p-3">
     La disposición declara qué se debe verificar o dejar sin efectos registrales, pero no borra
     el hecho histórico ni ejecuta automáticamente una anulación. Para cerrar se requieren las
     constancias de todas las parroquias afectadas.
   </p>
   {entries.map((entry,i)=><div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
     <div className="flex items-center justify-between"><strong className="text-sm">Partida {i+1}</strong>
       {entries.length>2&&<button type="button" className="text-xs font-semibold text-red-700"
         onClick={()=>onChange(entries.filter((_,j)=>i!==j))}>Quitar</button>}</div>
     <div className="grid gap-3 md:grid-cols-2">
       <CanonicalField label="Parroquia donde consta esta partida">
         <select required className={canonicalSelectClass} value={entry.external?'__external__':entry.parishId}
            onChange={e=>update(i,'parishId',e.target.value)}>
           <option value="">Seleccione parroquia...</option>
           {parishes.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
           <option value="__external__">Otra parroquia aún no operativa / fuera del sistema</option>
         </select>
       </CanonicalField>
       {entry.external&&<div className="md:col-span-2 grid gap-3 md:grid-cols-2">
          <CanonicalField label="Nombre real de la parroquia externa">
            <input required className={canonicalInputClass} maxLength={200} value={entry.parishName}
              onChange={e=>update(i,'parishName',e.target.value)}/>
          </CanonicalField>
          <CanonicalField label="Jurisdicción de la parroquia externa">
            <input className={canonicalInputClass} maxLength={200} value={entry.externalJurisdiction||''}
              placeholder="Diócesis o municipio" onChange={e=>update(i,'externalJurisdiction',e.target.value)}/>
          </CanonicalField>
        </div>}
       {!entry.external&&<CanonicalField label="Identificador de partida en SACRAMENTUM (si está digitalizada)">
         <input className={canonicalInputClass} value={entry.recordId||''}
           placeholder="UUID existente, opcional" onChange={e=>update(i,'recordId',e.target.value)}/>
       </CanonicalField>}
       {['book','folio','number'].map((k)=><CanonicalField key={k}
         label={{book:'Libro original',folio:'Folio original',number:'Número original'}[k]}>
         <input required maxLength={60} className={canonicalInputClass} value={entry[k]}
          onChange={e=>update(i,k,e.target.value)}/>
       </CanonicalField>)}
       <CanonicalField label="Disposición expresa de Cancillería" className="md:col-span-2">
         <select className={canonicalSelectClass} value={entry.disposition}
           onChange={e=>update(i,'disposition',e.target.value)}>
           {Object.entries(REPETITION_DISPOSITIONS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
         </select>
       </CanonicalField>
       <CanonicalField label="Fundamento individual y evidencia" className="md:col-span-2">
         <textarea required minLength={15} maxLength={1500} rows={2} className={canonicalTextareaClass}
           value={entry.justification} onChange={e=>update(i,'justification',e.target.value)}
           placeholder="Identifique por qué se conserva, cuestiona o declara sin efectos esta partida..."/>
       </CanonicalField>
     </div>
   </div>)}
   {entries.length<12&&<button className="rounded-xl border border-blue-300 bg-white px-4 py-2 text-xs font-bold text-blue-900"
     type="button" onClick={()=>onChange([...entries,emptyEntry()])}>Agregar otra partida</button>}
 </section>;
}
