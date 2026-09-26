import { supabase } from '@/lib/supabaseClient';

const CONFIG = {
  bautismo:{table:'baptisms',date:'celebration_date'},
  confirmacion:{table:'confirmations',date:'celebration_date'},
  matrimonio:{table:'marriages',date:'celebration_date'},
  exequias:{table:'funerals',date:'fecha_exequias'},
};

export async function listSacramentalBookRecords({ parishId, sacrament, book = '', yearFrom = '', yearTo = '' }) {
  const cfg=CONFIG[sacrament];
  if(!cfg) throw new Error('Sacramento no soportado.');
  let q=supabase.from(cfg.table).select('*').eq('parish_id',parishId).order('book_number').order('folio').order('number').limit(5000);
  if(book) q=q.eq('book_number',String(book));
  if(yearFrom) q=q.gte(cfg.date,`${yearFrom}-01-01`);
  if(yearTo) q=q.lte(cfg.date,`${yearTo}-12-31`);
  const {data,error}=await q;
  if(error) throw error;
  return (data||[]).filter(r=>!['anulada','anulado','annulled','deleted','reverted','cancelled'].includes(String(r.status||'').toLowerCase()));
}

export async function listSacramentalBookNumbers({ parishId, sacrament }) {
  const rows=await listSacramentalBookRecords({parishId,sacrament});
  return [...new Set(rows.map(r=>String(r.book_number||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}
