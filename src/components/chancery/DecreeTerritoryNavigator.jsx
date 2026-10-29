import React, { useMemo } from 'react';
import { Building2, FolderTree } from 'lucide-react';
import { buildDecreeTerritory } from '@/utils/decreeTerritory.mjs';

const norm = value => String(value || '');
export default function DecreeTerritoryNavigator({
  rows = [], parishes = [], vicaries = [], deaneries = [],
  selection = {}, onChange = () => {}, loading = false
}) {
  const index = useMemo(
    () => buildDecreeTerritory(rows,parishes,vicaries,deaneries),
    [rows,parishes,vicaries,deaneries]
  );
  const orderedVicaries = useMemo(() => [...vicaries].sort((a,b)=>a.name.localeCompare(b.name,'es')), [vicaries]);
  const currentDeaneries = deaneries.filter(d => norm(d.vicaria_id || d.vicaryId) === norm(selection.vicaryId));
  const currentParishes = parishes.filter(p => {
    if (selection.deaneryId) return norm(p.decanate_id || p.decanateId) === norm(selection.deaneryId);
    if (!selection.vicaryId) return true;
    return norm(p.vicary_id || p.vicaryId) === norm(selection.vicaryId);
  });
  const total = index.total;
  const select = next => onChange({ vicaryId:'', deaneryId:'', parishId:'', unassigned:false, ...next });
  const countLabel = (n) => `${n} ${n===1?'decreto':'decretos'}`;
  const entryButton = (caption, count, callback, active=false) => (
    <button type="button" onClick={callback}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${active?'border-blue-400 bg-blue-50 text-blue-900':'border-slate-100 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50'}`}>
      <span>{caption}</span><strong className="whitespace-nowrap text-slate-700">{count}</strong>
    </button>
  );

  return (
    <section aria-label="Organización territorial del archivo de decretos"
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <FolderTree className="mt-1 h-6 w-6 text-blue-700" aria-hidden="true"/>
          <div><h3 className="font-serif text-lg font-black text-slate-950">Archivo por organización eclesiástica</h3>
            <p className="mt-1 text-xs text-slate-600">Vicarías, decanatos cuando existan y parroquias · un solo archivo, sin duplicar decretos</p></div>
        </div>
        <strong className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900">{loading?'Consultando…':countLabel(total)}</strong>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-bold text-slate-700">Vicaría
          <select aria-label="Filtrar decretos por vicaría" value={selection.vicaryId || ''}
            onChange={e=>select({ vicaryId:e.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal">
            <option value="">Todas las vicarías</option>
            {orderedVicaries.map(v=><option key={v.id} value={v.id}>{v.name} · {index.byVicary[v.id]||0}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700">Decanato (opcional)
          <select aria-label="Filtrar decretos por decanato" value={selection.deaneryId || ''}
            disabled={!selection.vicaryId} onChange={e=>select({vicaryId:selection.vicaryId,deaneryId:e.target.value})}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal disabled:bg-slate-50">
            <option value="">Todos / parroquias directas</option>
            {currentDeaneries.map(d=><option key={d.id} value={d.id}>{d.name} · {index.byDeanery[d.id]||0}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700">Parroquia
          <select aria-label="Filtrar decretos por parroquia" value={selection.parishId || ''}
            onChange={e=>select({vicaryId:selection.vicaryId,deaneryId:selection.deaneryId,parishId:e.target.value})}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal">
            <option value="">Todas las parroquias</option>
            {currentParishes.map(p=><option key={p.id} value={p.id}>{p.name} · {index.byParish[p.id]||0}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {entryButton('Todos los decretos',total,()=>select({}),!selection.vicaryId&&!selection.deaneryId&&!selection.parishId&&!selection.unassigned)}
        {entryButton('Sin parroquia vinculada',index.unassigned,()=>select({unassigned:true}),!!selection.unassigned)}
        {entryButton('Limpiar selección',total,()=>select({}))}
      </div>
      <div className="mt-5 max-h-[350px] space-y-2 overflow-y-auto" aria-label="Árbol de decretos por jurisdicción">
        {orderedVicaries.map(v=>{
          const vicaryDeaneries = deaneries.filter(d=>norm(d.vicaria_id || d.vicaryId)===norm(v.id));
          const direct = parishes.filter(p=>norm(p.vicary_id || p.vicaryId)===norm(v.id) && !norm(p.decanate_id || p.decanateId));
          return (
            <details key={v.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-bold text-slate-900">
                <Building2 className="mr-2 inline h-4 w-4 text-blue-700" />{v.name}
                <span className="ml-2 text-xs font-semibold text-blue-700">{countLabel(index.byVicary[v.id]||0)}</span>
              </summary>
              <div className="mt-3 space-y-2 pl-2">
                {entryButton('Todos los de esta vicaría',index.byVicary[v.id]||0,()=>select({vicaryId:v.id}),selection.vicaryId===v.id&&!selection.deaneryId&&!selection.parishId)}
                {vicaryDeaneries.map(d=><details key={d.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-bold text-slate-800">{d.name} · {countLabel(index.byDeanery[d.id]||0)}</summary>
                  <div className="mt-2 space-y-2">
                    {entryButton('Todo el decanato',index.byDeanery[d.id]||0,()=>select({vicaryId:v.id,deaneryId:d.id}))}
                    {parishes.filter(p=>norm(p.decanate_id||p.decanateId)===norm(d.id)).map(p=>
                      <div key={p.id}>{entryButton(p.name,index.byParish[p.id]||0,()=>select({vicaryId:v.id,deaneryId:d.id,parishId:p.id}),selection.parishId===p.id)}</div>
                    )}
                  </div>
                </details>)}
                {direct.length>0&&<div className="rounded-xl border border-dashed border-blue-200 bg-white p-3">
                  <p className="mb-2 text-xs font-bold text-blue-800">Parroquias directamente adscritas a la vicaría</p>
                  <div className="space-y-2">{direct.map(p=><div key={p.id}>
                    {entryButton(p.name,index.byParish[p.id]||0,()=>select({vicaryId:v.id,parishId:p.id}),selection.parishId===p.id)}
                  </div>)}</div>
                </div>}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
