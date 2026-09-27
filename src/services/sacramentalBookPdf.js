import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const text=(v)=>String(v??'').trim();
const date=(v)=>v?String(v).slice(0,10):'—';
const raw=(r)=>r?.raw_data||{};
const person=(r)=>{
  const x=raw(r);
  return text([
    r?.nombres||x.nombres||x.names,
    r?.apellidos||x.apellidos||x.last_names
  ].filter(Boolean).join(' '))||'—';
};
const parents=(r)=>{
  const x=raw(r);
  const father=text(r?.nombre_padre||r?.nombrePadre||x.nombre_padre||x.nombrePadre||x.padre||x.legacy_normalized?.father_name);
  const mother=text(r?.nombre_madre||r?.nombreMadre||x.nombre_madre||x.nombreMadre||x.madre||x.legacy_normalized?.mother_name);
  return [father,mother].filter(Boolean).join(' / ')||'—';
};
const marriagePeople=(r)=>{
  const x=raw(r);
  const groom=[x.novioNombres||x.groomNames||r?.groomName,x.novioApellidos||x.groomLastNames||r?.groomSurname].filter(Boolean).join(' ').trim();
  const bride=[x.noviaNombres||x.brideNames||r?.brideName,x.noviaApellidos||x.brideLastNames||r?.brideSurname].filter(Boolean).join(' ').trim();
  return {groom:groom||'—',bride:bride||'—'};
};
const coord=(r)=>({
  book:text(r?.book_number||r?.Libro||raw(r).book_number||raw(r).libro)||'—',
  folio:text(r?.folio||r?.page_number||raw(r).folio||raw(r).page_number)||'—',
  number:text(r?.number||r?.entry_number||r?.numero||raw(r).number||raw(r).entry_number||raw(r).numero)||'—',
});

const rowFor=(s,r)=>{
  const c=coord(r);
  if(s==='bautismo') return [c.folio,c.number,person(r),date(r.celebration_date),date(r.fecha_nacimiento||raw(r).fecnac),parents(r)];
  if(s==='confirmacion') return [c.folio,c.number,person(r),date(r.celebration_date),date(r.fecha_nacimiento||raw(r).fecnac),text(r.padrinos||raw(r).padrinos||raw(r).padri)||'—',text(r.ministro||raw(r).ministro)||'—'];
  if(s==='matrimonio'){
    const p=marriagePeople(r);
    return [c.folio,c.number,p.groom,p.bride,date(r.celebration_date),text(raw(r).ministro||r.minister)||'—'];
  }
  return [c.folio,c.number,person(r),date(r.fecha_defuncion||raw(r).fecha_defuncion),date(r.fecha_exequias||raw(r).fecha_exequias),text(r.cementerio||raw(r).cementerio)||'—'];
};

const heads={
  bautismo:['Folio','N.º','Bautizado(a)','Bautismo','Nacimiento','Padres'],
  confirmacion:['Folio','N.º','Confirmando(a)','Confirmación','Nacimiento','Padrinos','Ministro'],
  matrimonio:['Folio','N.º','Contrayente 1','Contrayente 2','Matrimonio','Ministro'],
  exequias:['Folio','N.º','Difunto(a)','Defunción','Exequias','Cementerio'],
};
const names={bautismo:'BAUTISMOS',confirmacion:'CONFIRMACIONES',matrimonio:'MATRIMONIOS',exequias:'EXEQUIAS'};

const alphabeticalKey=(s,r)=>{
  if(s==='matrimonio'){
    const p=marriagePeople(r);
    return `${p.groom} ${p.bride}`.toLocaleUpperCase('es');
  }
  return person(r).toLocaleUpperCase('es');
};

const indexRowFor=(s,r,index)=>{
  const c=coord(r);
  if(s==='matrimonio'){
    const p=marriagePeople(r);
    return [index+1,p.groom,p.bride,c.book,c.folio,c.number];
  }
  if(s==='exequias') return [index+1,person(r),c.book,c.folio,c.number,date(r.fecha_exequias||raw(r).fecha_exequias)];
  return [index+1,person(r),parents(r),c.book,c.folio,c.number];
};

const indexHeads={
  bautismo:['#','Apellidos y nombres','Padres / filiación','Libro','Folio','N.º'],
  confirmacion:['#','Apellidos y nombres','Padres / filiación','Libro','Folio','N.º'],
  matrimonio:['#','Esposo','Esposa','Libro','Folio','N.º'],
  exequias:['#','Difunto(a)','Libro','Folio','N.º','Exequias'],
};

const drawFrame=(doc,{title,dioceseName,parishName,book,period,count})=>{
  doc.setDrawColor(46,82,118); doc.setLineWidth(.55); doc.rect(8,8,281,194);
  doc.setDrawColor(212,175,55); doc.setLineWidth(.2); doc.rect(10.5,10.5,276,189);
  doc.setFont('helvetica','bold'); doc.setTextColor(46,82,118); doc.setFontSize(8); doc.text(String(dioceseName||'JURISDICCIÓN ECLESIÁSTICA').toUpperCase(),148.5,18,{align:'center'});
  doc.setFont('times','bold'); doc.setTextColor(25,35,45); doc.setFontSize(17); doc.text(title,148.5,27,{align:'center'});
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.text(String(parishName||'PARROQUIA').toUpperCase(),148.5,33,{align:'center'});
  doc.setFont('helvetica','normal'); doc.setTextColor(90,100,110); doc.setFontSize(7); doc.text(`Libro: ${book||'Todos'} · Periodo: ${period||'Completo'} · Registros: ${count}`,148.5,39,{align:'center'});
};

const finalize=(doc,caption)=>{
  const pages=doc.getNumberOfPages();
  for(let i=1;i<=pages;i++){
    doc.setPage(i);
    doc.setDrawColor(220,224,229);doc.line(13,193,284,193);
    doc.setFontSize(6.5);doc.setTextColor(100,110,120);
    doc.text(`SACRAMENTUM · ${caption}`,13,197);
    doc.text(`Página ${i} de ${pages}`,284,197,{align:'right'});
  }
};

export function buildSacramentalBookPdf({records,sacrament,parishName,dioceseName,book,period}){
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
  doc.setProperties({title:`Libro de ${names[sacrament]} ${book||''}`,subject:'Libro sacramental',author:parishName||'SACRAMENTUM',creator:'SACRAMENTUM'});
  const drawHeader=()=>drawFrame(doc,{title:`LIBRO DE ${names[sacrament]}`,dioceseName,parishName,book,period,count:records.length});
  drawHeader();
  autoTable(doc,{
    startY:44,margin:{left:13,right:13,bottom:18},head:[heads[sacrament]],body:records.map(r=>rowFor(sacrament,r)),
    theme:'grid',styles:{font:'helvetica',fontSize:6.7,cellPadding:1.5,lineColor:[210,216,222],lineWidth:.12,textColor:[35,45,55]},
    headStyles:{fillColor:[55,88,121],textColor:[255,255,255],fontStyle:'bold'},
    didDrawPage:()=>{if(doc.getCurrentPageInfo().pageNumber>1)drawHeader();}
  });
  finalize(doc,'Libro sacramental generado desde los registros vigentes');
  return doc;
}

export function buildSacramentalIndexPdf({records,sacrament,parishName,dioceseName,book,period}){
  const sorted=[...(records||[])].sort((a,b)=>alphabeticalKey(sacrament,a).localeCompare(alphabeticalKey(sacrament,b),'es',{sensitivity:'base'}));
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
  doc.setProperties({title:`Índice de ${names[sacrament]} ${book||''}`,subject:'Índice alfabético sacramental',author:parishName||'SACRAMENTUM',creator:'SACRAMENTUM'});
  const drawHeader=()=>drawFrame(doc,{title:`ÍNDICE ALFABÉTICO DE ${names[sacrament]}`,dioceseName,parishName,book,period,count:sorted.length});
  drawHeader();
  autoTable(doc,{
    startY:44,margin:{left:13,right:13,bottom:18},head:[indexHeads[sacrament]],body:sorted.map((r,i)=>indexRowFor(sacrament,r,i)),
    theme:'grid',styles:{font:'helvetica',fontSize:6.9,cellPadding:1.6,lineColor:[210,216,222],lineWidth:.12,textColor:[35,45,55]},
    headStyles:{fillColor:[55,88,121],textColor:[255,255,255],fontStyle:'bold'},
    didDrawPage:()=>{if(doc.getCurrentPageInfo().pageNumber>1)drawHeader();}
  });
  finalize(doc,'Índice alfabético auxiliar del libro sacramental');
  return doc;
}

export function downloadSacramentalBookPdf(opts){
  const doc=buildSacramentalBookPdf(opts);
  const name=`Libro_${opts.sacrament}_${String(opts.book||'todos').replace(/[^a-z0-9_-]/gi,'_')}.pdf`;
  doc.save(name);return name;
}

export function downloadSacramentalIndexPdf(opts){
  const doc=buildSacramentalIndexPdf(opts);
  const name=`Indice_${opts.sacrament}_${String(opts.book||'todos').replace(/[^a-z0-9_-]/gi,'_')}.pdf`;
  doc.save(name);return name;
}
