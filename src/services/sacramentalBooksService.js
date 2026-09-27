import { supabase } from '@/lib/supabaseClient';

const CONFIG = {
  bautismo:{table:'baptisms',date:'celebration_date'},
  confirmacion:{table:'confirmations',date:'celebration_date'},
  matrimonio:{table:'marriages',date:'celebration_date'},
  exequias:{table:'funerals',date:'fecha_exequias'},
};

const PAGE_SIZE=1000;
// El libro sacramental es archivo, no una lista de "vigentes". Una partida
// anulada/corregida debe conservar su ubicación histórica y mostrarse con su
// estado. Solo se excluyen borradores que nunca debieron formar parte del libro.
const nonBookStatus=new Set(['pending','draft']);

const applyFilters=(query,{parishId,cfg,book,yearFrom,yearTo})=>{
  let q=query.eq('parish_id',parishId);
  if(book) q=q.eq('book_number',String(book));
  if(yearFrom) q=q.gte(cfg.date,`${yearFrom}-01-01`);
  if(yearTo) q=q.lte(cfg.date,`${yearTo}-12-31`);
  return q;
};

export async function listSacramentalBookRecords({ parishId, sacrament, book = '', yearFrom = '', yearTo = '' }) {
  const cfg=CONFIG[sacrament];
  if(!cfg) throw new Error('Sacramento no soportado.');
  if(!parishId) return [];

  const rows=[];
  let from=0;

  while(true){
    let q=supabase
      .from(cfg.table)
      .select('*')
      .order('book_number')
      .order('folio')
      .order('number')
      .range(from,from+PAGE_SIZE-1);

    q=applyFilters(q,{parishId,cfg,book,yearFrom,yearTo});
    const {data,error}=await q;
    if(error) throw error;

    const batch=data||[];
    rows.push(...batch);
    if(batch.length<PAGE_SIZE) break;
    from+=PAGE_SIZE;
  }

  return rows.filter(r=>!nonBookStatus.has(String(r.status||'').toLowerCase()));
}

export async function listSacramentalBookNumbers({ parishId, sacrament }) {
  const rows=await listSacramentalBookRecords({parishId,sacrament});
  return [...new Set(rows.map(r=>String(r.book_number||'').trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}
