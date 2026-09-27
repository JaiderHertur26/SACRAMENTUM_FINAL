import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const text=(v)=>String(v??'').trim();
const date=(v)=>v?String(v).slice(0,10):'—';
const raw=(r)=>r?.raw_data||{};
const legacy=(r)=>raw(r)?.legacy_normalized||{};
const isNarrative=(r)=>String(r?.historicalEntryMode||raw(r).historicalEntryMode||raw(r).historical_entry_mode||'').toLowerCase()==='narrative';
const narrativeReference=(r)=>text(r?.referenceName||raw(r).referenceName||raw(r).reference_name)||'ASIENTO HISTÓRICO NARRATIVO';
const narrativeText=(r)=>text(r?.literalTranscription||raw(r).literalTranscription||raw(r).literal_transcription);

const statusLabel=(r)=>{
  const value=String(r?.status||raw(r).status||raw(r).estado||'vigente').trim().toLowerCase();
  if(['anulada','anulado','annulled','nullified','nulo'].includes(value)) return 'ANULADA';
  if(['reversed','revertida','reverted'].includes(value)) return 'REVERTIDA';
  if(['replaced','deleted'].includes(value)) return 'REEMPLAZADA / NO VIGENTE';
  if(['cancelled','cancelado'].includes(value)) return 'CANCELADA';
  if(['seated','confirmed','celebrated','active','vigente',''].includes(value)) return 'VIGENTE';
  return value.toUpperCase();
};

const personParts=(r)=>{
  const x=raw(r), l=legacy(r);
  const names=text(r?.nombres||r?.first_name||x.nombres||x.names||x.firstName||l.names);
  const surnames=text(r?.apellidos||r?.last_name||x.apellidos||x.last_names||x.lastName||l.last_names);
  return {names,surnames};
};
const person=(r)=>{
  if(isNarrative(r)) return narrativeReference(r);
  const p=personParts(r);
  return text([p.surnames,p.names].filter(Boolean).join(', '))||'—';
};
const parents=(r)=>{
  const x=raw(r), l=legacy(r);
  const father=text(r?.nombre_padre||r?.nombrePadre||x.nombre_padre||x.nombrePadre||x.padre||x.fatherName||l.father_name);
  const mother=text(r?.nombre_madre||r?.nombreMadre||x.nombre_madre||x.nombreMadre||x.madre||x.motherName||l.mother_name);
  return [father,mother].filter(Boolean).join(' / ')||'—';
};
const marriagePeople=(r)=>{
  if(isNarrative(r)) return {groom:narrativeReference(r),bride:'TRANSCRIPCIÓN LITERAL',key:narrativeReference(r)};
  const x=raw(r), l=legacy(r);
  const p1=l.party_1||{}, p2=l.party_2||{};
  const groomNames=text(r?.groomName||x.groomName||x.groomNames||x.novioNombres||x.esposo?.nombres||x.nombres_esposo||x.nombr1||p1.names);
  const groomSurnames=text(r?.groomSurname||x.groomSurname||x.groomLastNames||x.novioApellidos||x.esposo?.apellidos||x.apellidos_esposo||x.apell1||p1.last_names);
  const brideNames=text(r?.brideName||x.brideName||x.brideNames||x.noviaNombres||x.esposa?.nombres||x.nombres_esposa||x.nombr2||p2.names);
  const brideSurnames=text(r?.brideSurname||x.brideSurname||x.brideLastNames||x.noviaApellidos||x.esposa?.apellidos||x.apellidos_esposa||x.apell2||p2.last_names);
  const groom=text([groomSurnames,groomNames].filter(Boolean).join(', '))||'—';
  const bride=text([brideSurnames,brideNames].filter(Boolean).join(', '))||'—';
  return {groom,bride,key:`${groomSurnames} ${groomNames} ${brideSurnames} ${brideNames}`.trim()};
};
const coord=(r)=>({
  book:text(r?.book_number||r?.Libro||raw(r).book_number||raw(r).Libro||raw(r).libro)||'—',
  folio:text(r?.folio||r?.page_number||raw(r).folio||raw(r).page_number)||'—',
  number:text(r?.number||r?.entry_number||r?.numero||raw(r).number||raw(r).entry_number||raw(r).numero||raw(r).numeroActa)||'—',
});
const minister=(r)=>{
  const x=raw(r), l=legacy(r);
  return text(r?.ministro||r?.minister||x.ministro||x.minister||x.presenciaria||l.minister)||'—';
};
const sacramentDate=(s,r)=>{
  const x=raw(r), l=legacy(r);
  if(s==='bautismo') return r?.celebration_date||x.fechaSacramento||x.fechaBautismo||x.fecbau||l.celebration_date;
  if(s==='confirmacion') return r?.celebration_date||x.fechaSacramento||x.fechaConfirmacion||x.feccon||l.celebration_date;
  if(s==='matrimonio') return r?.celebration_date||x.sacramentDate||x.fechaSacramento||x.fechaMatrimonio||x.fecmat||l.celebration_date;
  return r?.fecha_exequias||x.fecha_exequias||x.fechaExequias;
};

const rowFor=(s,r)=>{
  const c=coord(r);
  if(s==='bautismo') return [c.folio,c.number,person(r),date(sacramentDate(s,r)),date(r.fecha_nacimiento||raw(r).fechaNacimiento||raw(r).fecnac||legacy(r).birth_date),parents(r),statusLabel(r)];
  if(s==='confirmacion') return [c.folio,c.number,person(r),date(sacramentDate(s,r)),date(r.fecha_nacimiento||raw(r).fechaNacimiento||raw(r).fecnac||legacy(r).birth_date),text(r.padrinos||raw(r).padrinos||raw(r).padri||legacy(r).sponsor)||'—',minister(r),statusLabel(r)];
  if(s==='matrimonio'){
    const p=marriagePeople(r);
    return [c.folio,c.number,p.groom,p.bride,date(sacramentDate(s,r)),minister(r),statusLabel(r)];
  }
  return [c.folio,c.number,person(r),date(r.fecha_defuncion||raw(r).fecha_defuncion||raw(r).fechaDefuncion),date(sacramentDate(s,r)),text(r.cementerio||raw(r).cementerio)||'—',statusLabel(r)];
};

const heads={
  bautismo:['Folio','N.º','Bautizado(a)','Bautismo','Nacimiento','Padres','Estado'],
  confirmacion:['Folio','N.º','Confirmando(a)','Confirmación','Nacimiento','Padrinos','Ministro','Estado'],
  matrimonio:['Folio','N.º','Contrayente 1','Contrayente 2','Matrimonio','Ministro','Estado'],
  exequias:['Folio','N.º','Difunto(a)','Defunción','Exequias','Cementerio','Estado'],
};
const names={bautismo:'BAUTISMOS',confirmacion:'CONFIRMACIONES',matrimonio:'MATRIMONIOS',exequias:'EXEQUIAS'};

const alphabeticalKey=(s,r)=>{
  if(isNarrative(r)) return narrativeReference(r).toLocaleUpperCase('es');
  if(s==='matrimonio') return marriagePeople(r).key.toLocaleUpperCase('es');
  const p=personParts(r);
  return `${p.surnames} ${p.names}`.toLocaleUpperCase('es');
};

const indexRowFor=(s,r,index)=>{
  const c=coord(r);
  if(s==='matrimonio'){
    const p=marriagePeople(r);
    return [index+1,p.groom,p.bride,c.book,c.folio,c.number,statusLabel(r)];
  }
  if(s==='exequias') return [index+1,person(r),c.book,c.folio,c.number,date(sacramentDate(s,r)),statusLabel(r)];
  return [index+1,person(r),isNarrative(r)?'TRANSCRIPCIÓN LITERAL':parents(r),c.book,c.folio,c.number,statusLabel(r)];
};

const indexHeads={
  bautismo:['#','Apellidos y nombres','Padres / filiación','Libro','Folio','N.º','Estado'],
  confirmacion:['#','Apellidos y nombres','Padres / filiación','Libro','Folio','N.º','Estado'],
  matrimonio:['#','Esposo','Esposa','Libro','Folio','N.º','Estado'],
  exequias:['#','Difunto(a)','Libro','Folio','N.º','Exequias','Estado'],
};

const bookBodyRows=(s,records)=>(records||[]).map((r)=>{
  if(!isNarrative(r)) return rowFor(s,r);
  const c=coord(r);
  const body=narrativeText(r)||'SIN TRANSCRIPCIÓN DISPONIBLE';
  return [{
    content:`Folio ${c.folio} · N.º ${c.number} · ${narrativeReference(r)} · ${statusLabel(r)}\n${body}`,
    colSpan:heads[s].length,
    styles:{font:'times',fontSize:7.5,cellPadding:3,fontStyle:'normal'}
  }];
});

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
    startY:44,margin:{left:13,right:13,bottom:18},head:[heads[sacrament]],body:bookBodyRows(sacrament,records),
    theme:'grid',styles:{font:'helvetica',fontSize:6.7,cellPadding:1.5,lineColor:[210,216,222],lineWidth:.12,textColor:[35,45,55]},
    headStyles:{fillColor:[55,88,121],textColor:[255,255,255],fontStyle:'bold'},
    didDrawPage:()=>{if(doc.getCurrentPageInfo().pageNumber>1)drawHeader();}
  });
  finalize(doc,'Libro sacramental · archivo registral con estados históricos');
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
