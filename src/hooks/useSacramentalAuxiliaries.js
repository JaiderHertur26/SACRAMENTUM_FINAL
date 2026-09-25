import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const upper = (value='') => String(value || '').trim().toUpperCase();
const fullName = (row={}) => upper(
  row.nombreCompleto ||
  row.bishop_name ||
  [row.nombre,row.apellido].filter(Boolean).join(' ')
);

const toDate = (value) => {
  if (!value) return null;
  const raw = String(value).slice(0,10);
  const date = new Date(`${raw}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const inside = (dateValue,startValue,endValue) => {
  const date=toDate(dateValue || new Date().toISOString().slice(0,10));
  const start=toDate(startValue);
  const end=toDate(endValue);
  if (!date) return false;
  if (start && date<start) return false;
  if (end && date>end) return false;
  return true;
};

const latestAt = (rows,date,startKey,endKey) => {
  const target=date || new Date().toISOString().slice(0,10);
  const eligible=(rows || []).filter(r=>{
    const start=toDate(r[startKey]);
    return Boolean(start) && inside(target,r[startKey],r[endKey]);
  });
  return [...eligible].sort((a,b)=>{
    const av=toDate(a[startKey])?.getTime() || 0;
    const bv=toDate(b[startKey])?.getTime() || 0;
    return bv-av;
  })[0] || null;
};

export default function useSacramentalAuxiliaries(parishId, parishName='') {
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState({
    priests:[],churches:[],cities:[],bishops:[],bishopTenures:[]
  });

  const refresh=useCallback(async()=>{
    if(!parishId) return;
    setLoading(true);
    try{
      const [p,c,ci,b,bt]=await Promise.all([
        supabase.from('parrocos').select('*').eq('parish_id',parishId),
        supabase.from('iglesias').select('*').eq('parish_id',parishId).order('nombre'),
        supabase.from('ciudades').select('*').eq('context_id',parishId).order('nombre'),
        supabase.from('obispos').select('*').eq('parish_id',parishId).order('nombre'),
        supabase.from('bishop_tenures').select('*').eq('parish_id',parishId).order('start_date',{ascending:false})
      ]);
      const err=[p,c,ci,b,bt].map(x=>x.error).find(Boolean);
      if(err) throw err;
      setData({
        priests:p.data||[],churches:c.data||[],cities:ci.data||[],
        bishops:b.data||[],bishopTenures:bt.data||[]
      });
    }catch(error){
      console.error('Auxiliary catalogs load error:',error);
    }finally{
      setLoading(false);
    }
  },[parishId]);

  useEffect(()=>{ refresh(); },[refresh]);

  const priestAtDate=useCallback((date)=>{
    const target=date || new Date().toISOString().slice(0,10);
    const targetDate=toDate(target);
    const dated=(data.priests || [])
      .filter((row)=>toDate(row.fecha_ingreso))
      .sort((a,b)=>{
        const av=toDate(a.fecha_ingreso)?.getTime() || 0;
        const bv=toDate(b.fecha_ingreso)?.getTime() || 0;
        return bv-av;
      });
    const latest=dated[0] || null;
    const row=dated.find((row)=>{
      const start=toDate(row.fecha_ingreso);
      if(!targetDate || !start || targetDate<start) return false;
      if(latest && row.id===latest.id) return true;
      const end=toDate(row.fecha_salida);
      return !end || targetDate<=end;
    }) || null;
    return row ? {...row,nombreCompleto:fullName(row)} : null;
  },[data.priests]);

  const currentPriest=useMemo(()=>{
    const dated=(data.priests || [])
      .filter((row)=>toDate(row.fecha_ingreso))
      .sort((a,b)=>{
        const av=toDate(a.fecha_ingreso)?.getTime() || 0;
        const bv=toDate(b.fecha_ingreso)?.getTime() || 0;
        return bv-av;
      });
    const row=dated[0] || [...(data.priests || [])].sort((a,b)=>
      String(b.created_at || '').localeCompare(String(a.created_at || ''))
    )[0] || null;
    return row ? {...row,nombreCompleto:fullName(row)} : null;
  },[data.priests]);

  const bishopAtDate=useCallback((date)=>{
    const row=latestAt(data.bishopTenures,date,'start_date','end_date');
    return row ? {...row,nombreCompleto:fullName(row)} : null;
  },[data.bishopTenures]);

  const values=useMemo(()=>({
    cityOptions:[...new Set(data.cities.map(x=>upper(x.nombre)).filter(Boolean))],
    churchOptions:[...new Set([
      upper(parishName),
      ...data.churches.map(x=>upper(x.nombre))
    ].filter(Boolean))],
    priestOptions:[...new Set(data.priests.map(fullName).filter(Boolean))],
    bishopOptions:[...new Set([
      ...data.bishops.map(fullName),
      ...data.bishopTenures.map(fullName)
    ].filter(Boolean))]
  }),[data,parishName]);

  return {
    ...data,...values,loading,refresh,
    currentPriest,
    priestAtDate,bishopAtDate
  };
}
