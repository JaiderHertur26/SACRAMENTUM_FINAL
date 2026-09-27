import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const text=(v)=>String(v??'').trim();
const date=(v)=>v?String(v).slice(0,10):'—';
const person=(r)=>text([r.nombres,r.apellidos].filter(Boolean).join(' '))||text(r.raw_data?.nombres)||'—';

const rowFor=(s,r)=>{
  if(s==='bautismo') return [r.folio||'—',r.number||'—',person(r),date(r.celebration_date),date(r.fecha_nacimiento),text(r.nombre_padre)||'—',text(r.nombre_madre)||'—'];
  if(s==='confirmacion') return [r.folio||'—',r.number||'—',person(r),date(r.celebration_date),date(r.fecha_nacimiento),text(r.padrinos)||'—',text(r.ministro)||'—'];
  if(s==='matrimonio'){
    const raw=r.raw_data||{}; const a=[raw.novioNombres||raw.groomNames,raw.novioApellidos||raw.groomLastNames].filter(Boolean).join(' '); const b=[raw.noviaNombres||raw.brideNames,raw.noviaApellidos||raw.brideLastNames].filter(Boolean).join(' ');
    return [r.folio||'—',r.number||'—',a||'—',b||'—',date(r.celebration_date),text(raw.ministro||r.minister)||'—'];
  }
  return [r.folio||'—',r.number||'—',person(r),date(r.fecha_defuncion),date(r.fecha_exequias),text(r.cementerio)||'—'];
};

const heads={
  bautismo:['Folio','N.º','Bautizado(a)','Bautismo','Nacimiento','Padre','Madre'],
  confirmacion:['Folio','N.º','Confirmando(a)','Confirmación','Nacimiento','Padrinos','Ministro'],
  matrimonio:['Folio','N.º','Contrayente 1','Contrayente 2','Matrimonio','Ministro'],
  exequias:['Folio','N.º','Difunto(a)','Defunción','Exequias','Cementerio'],
};
const names={bautismo:'BAUTISMOS',confirmacion:'CONFIRMACIONES',matrimonio:'MATRIMONIOS',exequias:'EXEQUIAS'};

export function buildSacramentalBookPdf({records,sacrament,parishName,dioceseName,book,period}){
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
  doc.setProperties({title:`Libro de ${names[sacrament]} ${book||''}`,subject:'Libro sacramental',author:parishName||'SACRAMENTUM',creator:'SACRAMENTUM'});
  const drawHeader=()=>{
    doc.setDrawColor(46,82,118); doc.setLineWidth(.55); doc.rect(8,8,281,194);
    doc.setDrawColor(212,175,55); doc.setLineWidth(.2); doc.rect(10.5,10.5,276,189);
    doc.setFont('helvetica','bold'); doc.setTextColor(46,82,118); doc.setFontSize(8); doc.text(String(dioceseName||'JURISDICCIÓN ECLESIÁSTICA').toUpperCase(),148.5,18,{align:'center'});
    doc.setFont('times','bold'); doc.setTextColor(25,35,45); doc.setFontSize(17); doc.text(`LIBRO DE ${names[sacrament]}`,148.5,27,{align:'center'});
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.text(String(parishName||'PARROQUIA').toUpperCase(),148.5,33,{align:'center'});
    doc.setFont('helvetica','normal'); doc.setTextColor(90,100,110); doc.setFontSize(7); doc.text(`Libro: ${book||'Todos'} · Periodo: ${period||'Completo'} · Registros: ${records.length}`,148.5,39,{align:'center'});
  };
  drawHeader();
  autoTable(doc,{
    startY:44,margin:{left:13,right:13,bottom:18},head:[heads[sacrament]],body:records.map(r=>rowFor(sacrament,r)),
    theme:'grid',styles:{font:'helvetica',fontSize:6.7,cellPadding:1.5,lineColor:[210,216,222],lineWidth:.12,textColor:[35,45,55]},
    headStyles:{fillColor:[55,88,121],textColor:[255,255,255],fontStyle:'bold'},
    didDrawPage:()=>{ if(doc.getCurrentPageInfo().pageNumber>1) drawHeader(); }
  });
  const pages=doc.getNumberOfPages();
  for(let i=1;i<=pages;i++){doc.setPage(i);doc.setDrawColor(220,224,229);doc.line(13,193,284,193);doc.setFontSize(6.5);doc.setTextColor(100,110,120);doc.text('SACRAMENTUM · Libro sacramental generado desde los registros vigentes',13,197);doc.text(`Página ${i} de ${pages}`,284,197,{align:'right'});}
  return doc;
}
export function downloadSacramentalBookPdf(opts){const doc=buildSacramentalBookPdf(opts);const name=`Libro_${opts.sacrament}_${String(opts.book||'todos').replace(/[^a-z0-9_-]/gi,'_')}.pdf`;doc.save(name);return name;}
