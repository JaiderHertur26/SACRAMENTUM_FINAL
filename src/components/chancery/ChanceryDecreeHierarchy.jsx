import React, { useMemo, useState } from 'react';
import { Archive, ChevronDown, Church, Eye, FileText, FolderTree, Printer, RotateCcw } from 'lucide-react';
import { buildChanceryArchiveHierarchy } from '@/utils/chanceryArchiveHierarchy.mjs';
import { decreeCanReverse, decreeEffect, decreeTypeLabel } from '@/utils/decreeArchiveModel.mjs';
import { decreeCorrectedTargetName } from '@/utils/decreeCorrectedName.mjs';

const field=value=>String(value??'').trim()||'—';
const hierarchicalName = (type,name) => new RegExp('^'+type+'\\b','i').test(String(name||'')) ? String(name) : type+' '+String(name||'');
const location=payload=>payload?.originalLocation||payload?.originalPartidaSummary||{};
const originalText=payload=>{
  const loc=location(payload);
  const part=['book','folio','number'].map((key,i)=>{
    const fallbacks=[['libro'],['page'],['entry']];
    return ['L','F','N'][i]+'-'+field(loc[key]||loc[fallbacks[i][0]]);
  });
  return part.join(' · ');
};
const formatDate=value=>{
  const raw=String(value||'').trim();
  const match=raw.match(/^(\d{4})-(\d\d)-(\d\d)/);
  return match? `${match[3]}/${match[2]}/${match[1]}`:raw||'—';
};

export default function ChanceryDecreeHierarchy({
  rows=[],parishes=[],vicaries=[],deaneries=[],
  onView=()=>{},onReverse=()=>{}
}) {
  const hierarchy=useMemo(()=>buildChanceryArchiveHierarchy(rows,parishes,vicaries,deaneries),
    [rows,parishes,vicaries,deaneries]);
  const [expandedDetails,setExpandedDetails]=useState({});
  const count=n=>`${n} ${n===1?'decreto':'decretos'}`;
  const toggleRow=id=>setExpandedDetails(prev=>({...prev,[id]:!prev[id]}));

  const decreeTable=(entries)=>{
    if(!entries.length) return null;
    return (
      <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[750px] border-collapse text-left text-xs" aria-label="Decretos de la parroquia">
          <thead className="bg-slate-100 font-serif text-[12px] font-bold text-slate-950">
            <tr>
              <th scope="col" className="w-[13%] px-4 py-4">N.º Decreto</th>
              <th scope="col" className="w-[12%] px-3 py-4">Fecha</th>
              <th scope="col" className="w-[25%] px-3 py-4">Titular corregido</th>
              <th scope="col" className="w-[21%] px-3 py-4">Ubicación original</th>
              <th scope="col" className="w-[17%] px-3 py-4">Concepto</th>
              <th scope="col" className="px-3 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((row,i)=>{
              const payload=row.payload||{};
              const title=decreeCorrectedTargetName(payload,payload.targetName||payload.newTargetName,row.sacrament_type)
                ||payload?.concept||'Expediente sacramental';
              const showOriginal=(row.tipo||'').toLowerCase().includes('correcc');
              const showReverse=decreeCanReverse(row);
              return (
                <React.Fragment key={row.id}>
                  <tr className={i%2?'bg-slate-50/80':'bg-white'}>
                    <td className="px-4 py-4 align-top">
                      <span className="font-mono font-bold text-blue-700">{field(row.decree_number||payload.decreeNumber)}</span>
                    </td>
                    <td className="px-3 py-4 align-top text-slate-700">{formatDate(row.decree_date||payload.decreeDate)}</td>
                    <td className="px-3 py-4 align-top font-extrabold uppercase leading-relaxed text-violet-700">{title}</td>
                    <td className={'px-3 py-4 align-top font-mono leading-relaxed text-rose-600 '+(showOriginal && decreeEffect(row) !== 'sin_modificacion'?'line-through decoration-rose-400':'')}>
                      {showOriginal?originalText(payload):'—'}
                    </td>
                    <td className="px-3 py-4 align-top text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {decreeTypeLabel(row)}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" title="Ver el decreto" aria-label={`Ver decreto ${field(row.decree_number||payload.decreeNumber)}`}
                          onClick={()=>onView(row)} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                          <Eye className="h-4 w-4"/>
                        </button>
                        <button type="button" title="Ver detalles del expediente" aria-label="Ver detalles del expediente"
                          aria-expanded={!!expandedDetails[row.id]} onClick={()=>toggleRow(row.id)}
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                          <FileText className="h-4 w-4"/>
                        </button>
                        {showReverse&&<button type="button" title="Revertir con auditoría" aria-label="Revertir decreto con auditoría"
                          onClick={()=>onReverse(row)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-600">
                          <RotateCcw className="h-4 w-4"/>
                        </button>}
                      </div>
                    </td>
                  </tr>
                  {expandedDetails[row.id]&&<tr className="bg-blue-50/60">
                    <td colSpan={6} className="px-5 py-4 text-sm text-slate-700">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <p><strong>Tipo:</strong> {decreeTypeLabel(row)}</p>
                        <p><strong>Ubicación original:</strong> {originalText(payload)}</p>
                        <p><strong>Estado:</strong> {field(row.status)}</p>
                        <p className="sm:col-span-3"><strong>Parroquia:</strong> {field(row.parish_name)}</p>
                      </div>
                      <button type="button" className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50" onClick={()=>onView(row)}>
                        <Printer className="h-4 w-4"/> Ver o imprimir documento
                      </button>
                    </td>
                  </tr>}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const parishPanel=(parish)=>(
    <details key={parish.id} className="group/parish rounded-2xl border border-slate-200 bg-white shadow-sm" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-slate-950 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2 text-xs font-black uppercase md:text-sm">
          <Church className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true"/>{parish.name}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-800">{count(parish.rows.length)}</span>
          <ChevronDown className="h-4 w-4 text-slate-500 transition group-open/parish:rotate-180" aria-hidden="true"/>
        </span>
      </summary>
      <div className="px-4 pb-4">{decreeTable(parish.rows)}</div>
    </details>
  );

  return (
    <section aria-label="Archivo de decretos por organización eclesiástica"
      className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <FolderTree className="h-6 w-6 text-blue-700" aria-hidden="true"/>
          <div>
            <h2 className="font-serif text-xl font-black text-slate-950">Archivo por organización eclesiástica</h2>
            <p className="mt-1 text-xs text-slate-500">Vicaría · Decanato cuando exista · Parroquia · Decreto</p>
          </div>
        </div>
        <span className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">{count(hierarchy.total)}</span>
      </header>
      {hierarchy.total===0&&<p className="rounded-xl bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">No se encontraron decretos con los filtros seleccionados.</p>}
      {hierarchy.vicaries.map(v=>(
        <details key={v.id} className="group/vic overflow-hidden rounded-[1.8rem] border border-slate-200 bg-slate-50/60" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-5 py-5 marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-3">
              <span className="rounded-xl bg-white p-3 text-blue-700 shadow-sm"><FolderTree className="h-5 w-5"/></span>
              <span><strong className="block font-serif text-lg font-black uppercase text-slate-950">{hierarchicalName('Vicaría',v.name)}</strong>
                <small className="text-[10px] font-bold uppercase tracking-[.22em] text-slate-500">Jurisdicción zonal</small></span>
            </span>
            <span className="flex items-center gap-3">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-900">{count(v.count)}</span>
              <ChevronDown className="h-5 w-5 text-slate-500 transition group-open/vic:rotate-180"/>
            </span>
          </summary>
          <div className="space-y-4 p-4 sm:p-6">
            {v.deaneries.map(d=>(
              <details key={d.id} className="group/dean rounded-2xl border-l-4 border-blue-100 bg-white p-3 sm:p-4" open>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-2 marker:hidden [&::-webkit-details-marker]:hidden">
                  <strong className="font-serif text-sm font-black uppercase text-slate-800 sm:text-base">{hierarchicalName('Decanato',d.name)}</strong>
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-800">{count(d.count)}</span>
                    <ChevronDown className="h-4 w-4 text-slate-500 transition group-open/dean:rotate-180"/>
                  </span>
                </summary>
                <div className="space-y-3 pt-3">{d.parishes.map(parishPanel)}</div>
              </details>
            ))}
            {v.direct.length>0&&<div className="space-y-3 rounded-2xl border border-dashed border-blue-200 bg-white p-4">
              <h3 className="font-serif text-sm font-black text-slate-700">Parroquias adscritas directamente a esta vicaría</h3>
              {v.direct.map(parishPanel)}
            </div>}
          </div>
        </details>
      ))}
      {hierarchy.unassigned.length>0&&
        <details className="group/unknown rounded-2xl border border-amber-200 bg-amber-50" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-black text-amber-900 marker:hidden">
            <span className="flex items-center gap-2"><Archive className="h-5 w-5"/>Decretos históricos sin parroquia vinculada</span>
            <span className="flex items-center gap-2 text-xs">{count(hierarchy.unassigned.length)}<ChevronDown className="h-4 w-4 group-open/unknown:rotate-180"/></span>
          </summary>
          <div className="px-4 pb-4">{decreeTable(hierarchy.unassigned)}</div>
        </details>}
    </section>
  );
}
