import { buildDecreeTerritory } from './decreeTerritory.mjs';

const val = value => String(value || '');
const sortName = (a,b) => val(a.name).localeCompare(val(b.name),'es',{sensitivity:'base'});
export function buildChanceryArchiveHierarchy(rows=[],parishes=[],vicaries=[],deaneries=[]) {
  const index=buildDecreeTerritory(rows,parishes,vicaries,deaneries);
  const byParish=new Map(), unassigned=[];
  const pMap=new Map(parishes.map(p=>[val(p.id),p]));
  const dMap=new Map(deaneries.map(d=>[val(d.id),d]));
  for(const row of rows) {
    const t=index.entries.get(val(row.id));
    if(!t?.linked || !pMap.has(t.parishId)) {unassigned.push(row);continue;}
    if(!byParish.has(t.parishId)) byParish.set(t.parishId,[]);
    byParish.get(t.parishId).push(row);
  }
  const parishGroup=p=>({id:val(p.id),name:p.name,rows:byParish.get(val(p.id))||[]});
  const vicaryGroups=vicaries.slice().sort(sortName).map(v=>{
    const daughters=deaneries.filter(d=>val(d.vicaria_id||d.vicaryId)===val(v.id))
      .sort(sortName).map(d=>{
        const children=parishes.filter(p=>val(p.decanate_id||p.decanateId)===val(d.id)
          && val(p.vicary_id||p.vicaryId)===val(v.id))
          .sort(sortName).map(parishGroup).filter(p=>p.rows.length);
        return {...d,parishes:children,count:children.reduce((n,p)=>n+p.rows.length,0)};
      }).filter(d=>d.count);
    const direct=parishes.filter(p=>val(p.vicary_id||p.vicaryId)===val(v.id) && !val(p.decanate_id||p.decanateId))
      .sort(sortName).map(parishGroup).filter(p=>p.rows.length);
    const count=daughters.reduce((n,d)=>n+d.count,0)+direct.reduce((n,p)=>n+p.rows.length,0);
    return {...v,deaneries:daughters,direct,count};
  }).filter(v=>v.count);
  const counted=vicaryGroups.reduce((n,v)=>n+v.count,0);
  // Fallback catches inconsistent current hierarchies without hiding or duplicating decrees.
  const assigned=new Set(vicaryGroups.flatMap(v=>[
    ...v.direct.flatMap(p=>p.rows.map(r=>val(r.id))),
    ...v.deaneries.flatMap(d=>d.parishes.flatMap(p=>p.rows.map(r=>val(r.id))))
  ]));
  for(const row of rows) if(!assigned.has(val(row.id)) && !unassigned.includes(row)) unassigned.push(row);
  return {vicaries:vicaryGroups,unassigned,total:rows.length,visibleCount:counted+unassigned.length,index};
}
