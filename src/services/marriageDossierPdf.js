import { jsPDF } from 'jspdf';

const BLUE=[61,105,146];
const GOLD=[212,175,55];
const INK=[28,36,48];
const SLATE=[100,116,139];

const val=(v)=>String(v??'').trim()||'—';
const yes=(v)=>val(v);

const frame=(doc)=>{
  const w=doc.internal.pageSize.getWidth();
  const h=doc.internal.pageSize.getHeight();
  doc.setDrawColor(...BLUE); doc.setLineWidth(.45); doc.rect(9,9,w-18,h-18);
  doc.setDrawColor(...GOLD); doc.setLineWidth(.18); doc.rect(11.2,11.2,w-22.4,h-22.4);
};

const header=(doc,{dioceseName,parishName,dossierNumber,pageTitle})=>{
  frame(doc);
  doc.setFont('helvetica','bold'); doc.setFontSize(7.8); doc.setTextColor(...BLUE);
  doc.text(String(dioceseName||'JURISDICCIÓN ECLESIÁSTICA').toUpperCase(),105,19,{align:'center'});
  doc.setFont('times','bold'); doc.setFontSize(15); doc.setTextColor(...INK);
  doc.text('EXPEDIENTE MATRIMONIAL',105,28,{align:'center'});
  doc.setFont('helvetica','normal'); doc.setFontSize(7.2); doc.setTextColor(...SLATE);
  doc.text(String(parishName||'Parroquia').toUpperCase(),105,34,{align:'center'});
  doc.text((dossierNumber?'Expediente '+dossierNumber+' · ':'')+pageTitle,105,39,{align:'center'});
};const footer=(doc,page,pages)=>{
  const h=doc.internal.pageSize.getHeight(); const w=doc.internal.pageSize.getWidth();
  doc.setDrawColor(225,230,236); doc.line(15,h-18,w-15,h-18);
  doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...SLATE);
  doc.text('SACRAMENTUM · Expediente canónico matrimonial',15,h-13.5);
  doc.text('Página '+page+' de '+pages,w-15,h-13.5,{align:'right'});
};

const section=(doc,title,y)=>{
  doc.setFillColor(241,246,251); doc.roundedRect(15,y,180,7,1.2,1.2,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...BLUE);
  doc.text(String(title).toUpperCase(),19,y+4.8);
  return y+11;
};

const field=(doc,label,value,x,y,w=82)=>{
  doc.setFont('helvetica','bold'); doc.setFontSize(6.3); doc.setTextColor(...SLATE);
  doc.text(String(label).toUpperCase(),x,y);
  doc.setFont('times','normal'); doc.setFontSize(8.2); doc.setTextColor(...INK);
  const lines=doc.splitTextToSize(val(value),w);
  doc.text(lines,x,y+4);
  return Math.max(8,lines.length*4+5);
};

const interviewRows=[
 ['Libertad para contraer','freedomToMarry'],
 ['Matrimonio anterior','previousMarriage'],
 ['Resolución vínculo anterior','previousMarriageResolution'],
 ['Parentesco','kinship'],
 ['Convivencia actual','cohabitation'],
 ['Unión civil','civilUnion'],
 ['Hijos de unión anterior','childrenPreviousUnion'],
 ['Condición eclesial / religión','ecclesialStatus'],
 ['Confirmación','confirmationStatus'],
 ['Práctica de la fe','faithPractice'], ['Consentimiento libre','freeConsent'],
 ['Presión, temor o coacción','coercionOrFear'],
 ['Comprensión del matrimonio cristiano','understandingMarriage'],
 ['Intención de permanencia','intentionPermanence'],
 ['Intención de fidelidad','intentionFidelity'],
 ['Apertura a los hijos','intentionChildren'],
 ['Órdenes sagradas o votos','holyOrdersOrVows'],
 ['Oposición familiar','familyOpposition'],
 ['Observaciones reservadas','observations'],
] ;

const drawInterview=(doc,title,data,startY=48)=>{
  let y=section(doc,title,startY);
  for(const [label,key] of interviewRows){
    if(y>258){ doc.addPage(); frame(doc); y=20; }
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...SLATE);
    doc.text(label,18,y);
    doc.setFont('times','normal'); doc.setFontSize(7.6); doc.setTextColor(...INK);
    const lines=doc.splitTextToSize(yes(data?.[key]),108);
    doc.text(lines,83,y);
    y+=Math.max(6,lines.length*3.5+2);
    doc.setDrawColor(235,238,242); doc.line(18,y-1,192,y-1);
  }
};

export function buildMarriageDossierPdf({dossier,answers,pendingMarriage,parishName,dioceseName}={}){
  const doc=new jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});
  const meta=dossier||{}; const data=answers||{};  header(doc,{dioceseName,parishName,dossierNumber:meta.dossierNumber,pageTitle:'Hoja I · Identificación y entrevista del novio'});
  let y=48;
  y=section(doc,'Identificación del expediente',y);
  const groom=[pendingMarriage?.novioNombres,pendingMarriage?.novioApellidos].filter(Boolean).join(' ');
  const bride=[pendingMarriage?.noviaNombres,pendingMarriage?.noviaApellidos].filter(Boolean).join(' ');
  field(doc,'Novio',groom,18,y,78); field(doc,'Novia',bride,108,y,78); y+=13;
  field(doc,'Fecha del expediente',meta.dossierDate,18,y,50); field(doc,'Fecha prevista matrimonio',meta.plannedMarriageDate,78,y,50); field(doc,'Lugar',meta.ceremonyPlace,138,y,48);
  drawInterview(doc,'Entrevista personal del novio',data.groom,y+14);

  doc.addPage();
  header(doc,{dioceseName,parishName,dossierNumber:meta.dossierNumber,pageTitle:'Hoja II · Entrevista de la novia'});
  drawInterview(doc,'Entrevista personal de la novia',data.bride,48);

  doc.addPage();
  header(doc,{dioceseName,parishName,dossierNumber:meta.dossierNumber,pageTitle:'Hoja III · Testigos y documentación'});
  y=48;
  for(const [idx,key] of [[1,'witness1'],[2,'witness2']]){
    y=section(doc,'Testigo '+idx,y); const w=data[key]||{};
    field(doc,'Nombre',w.name,18,y,78); field(doc,'Documento',w.document,108,y,78); y+=11;
    field(doc,'Relación',w.relationship,18,y,52); field(doc,'Años de conocimiento',w.yearsKnown,78,y,48); field(doc,'Credibilidad',w.credibility,138,y,48); y+=11;
    field(doc,'Confirma libertad matrimonial',w.confirmsFreedom,18,y,78); field(doc,'Coacción conocida',w.knowsCoercion,108,y,78); y+=12;
    field(doc,'Observaciones',w.observations,18,y,168); y+=17;
  }  y=section(doc,'Documentación verificada',y);
  const docs=data.documents||{};
  const docRows=[['Bautismo novio','groomBaptism'],['Bautismo novia','brideBaptism'],['Confirmación novio','groomConfirmation'],['Confirmación novia','brideConfirmation'],['Curso prematrimonial','premaritalCourse'],['Documentos civiles','civilDocuments'],['Identidad','identityDocuments'],['Proclamas','proclamations'],['Dispensas','dispensations'],['Licencias / permisos','licenses'],['Vínculo anterior','previousMarriageProof'],['Matrimonio mixto / disparidad','mixedMarriageRequirements'],['Otros','other']];
  for(const [label,key] of docRows){ field(doc,label,docs[key],18,y,168); y+=8; if(y>263) break; }

  doc.addPage();
  header(doc,{dioceseName,parishName,dossierNumber:meta.dossierNumber,pageTitle:'Hoja IV · Valoración canónica y acta'});
  y=48; y=section(doc,'Acta y conclusión canónica',y);
  const act=data.act||{};
  for(const [label,key] of [['Valoración canónica','canonicalAssessment'],['Impedimentos / situaciones','impediments'],['Dispensas concedidas','dispensationsGranted'],['Declaración / conclusión','declaration'],['Observaciones finales','observations'],['Certificación del párroco','pastorCertification']]){
    const h=field(doc,label,act[key],18,y,168); y+=Math.max(13,h+3);
  }
  const sy=Math.min(Math.max(y+15,225),255);
  doc.setDrawColor(...INK); doc.line(28,sy,88,sy); doc.line(122,sy,182,sy);
  doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...SLATE);
  doc.text('CONTRAYENTES / TESTIGOS',58,sy+5,{align:'center'}); doc.text('PÁRROCO / AUTORIDAD',152,sy+5,{align:'center'});

  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p+=1){doc.setPage(p);footer(doc,p,pages);}
  return doc;
}

const filename=(dossier)=>'Expediente_Matrimonial_'+String(dossier?.dossierNumber||'SIN_NUMERO').replace(/[^A-Za-z0-9_-]/g,'_')+'.pdf';
export const createMarriageDossierPdfBlob=(options={})=>buildMarriageDossierPdf(options).output('blob');
export const downloadMarriageDossierPdf=(options={})=>{const doc=buildMarriageDossierPdf(options);const name=filename(options.dossier);doc.save(name);return name;};