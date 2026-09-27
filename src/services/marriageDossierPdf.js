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

const drawPartyIdentification=(doc,data,y)=>{
  const id=data?.identification||{};
  if(!Object.values(id).some(v=>String(v??'').trim())) return y;
  y=section(doc,'Identificación y antecedentes documentales',y);
  field(doc,'Nombre completo',id.fullName,18,y,78); field(doc,'Documento',id.document,108,y,40); field(doc,'Expedido en',id.documentIssuedAt,154,y,32); y+=11;
  field(doc,'Ocupación / oficio',id.occupation,18,y,52); field(doc,'Empresa',id.employer,76,y,52); field(doc,'Teléfono',id.phone,134,y,52); y+=11;
  field(doc,'Dirección',id.address,18,y,78); field(doc,'Ciudad',id.city,108,y,78); y+=11;
  field(doc,'Bautismo · lugar/código',id.baptismPlaceCode,18,y,55); field(doc,'Fecha',id.baptismDate,79,y,32);
  field(doc,'Libro',id.baptismBook,117,y,18); field(doc,'Folio',id.baptismFolio,141,y,18); field(doc,'Número',id.baptismNumber,165,y,21); y+=11;
  field(doc,'Confirmación · lugar/código',id.confirmationPlaceCode,18,y,78);
  field(doc,'Padre',id.fatherName,108,y,78); y+=11;
  field(doc,'Madre',id.motherName,18,y,168); y+=12;
  return y;
};

const interviewRows=[
 ['Tiempo de noviazgo','datingDuration'],
 ['Parentesco','kinship'],
 ['Convivencia en unión libre','cohabitation'],
 ['Tiempo de convivencia','cohabitationDuration'],
 ['Pertenencia a otra religión','belongedOtherReligion'],
 ['Conoce las principales verdades de la Fe','knowsFaithTruths'],
 ['Comprende que el Matrimonio Católico es Sacramento','understandsSacrament'],
 ['Comprende unidad e indisolubilidad','understandsUnityIndissolubility'],
 ['Comprende que es para toda la vida','understandsLifelong'],
 ['Responsabilidad de formar familia','understandsFamilyResponsibility'],
 ['Matrimonio condicionado','conditionedMarriage'],
 ['Libertad para contraer','freedomToMarry'],
 ['Matrimonio anterior','previousMarriage'],
 ['Resolución vínculo anterior','previousMarriageResolution'],
 ['Unión civil','civilUnion'],
 ['Hijos de unión anterior','childrenPreviousUnion'],
 ['Unión libre anterior con otra persona','previousCohabitationOther'],
 ['Condición eclesial / religión','ecclesialStatus'],
 ['Confirmación','confirmationStatus'],
 ['Práctica de la fe','faithPractice'],
 ['Consentimiento libre','freeConsent'],
 ['Presión, temor o coacción','coercionOrFear'],
 ['Comprensión del matrimonio cristiano','understandingMarriage'],
 ['Intención de permanencia','intentionPermanence'],
 ['Intención de fidelidad','intentionFidelity'],
 ['Apertura a los hijos','intentionChildren'],
 ['Órdenes sagradas o votos','holyOrdersOrVows'],
 ['Familia de acuerdo','familyAgreement'],
 ['Oposición familiar relevante','familyOpposition'],
 ['Tiene declaración adicional','hasAdditionalDeclaration'],
 ['Declaración adicional / observaciones','observations'],
];

const drawInterview=(doc,title,data,startY=48,headerOptions={})=>{
  let y=section(doc,title,startY);
  for(const [label,key] of interviewRows){
    if(y>258){
      doc.addPage();
      header(doc,{...headerOptions,pageTitle:`${headerOptions.pageTitle || title} · continuación`});
      y=section(doc,title,48);
    }
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...SLATE);
    doc.text(label,18,y);
    doc.setFont('times','normal'); doc.setFontSize(7.6); doc.setTextColor(...INK);
    const lines=doc.splitTextToSize(yes(data?.[key]),108);
    doc.text(lines,83,y);
    y+=Math.max(6,lines.length*3.5+2);
    doc.setDrawColor(235,238,242); doc.line(18,y-1,192,y-1);
  }
};

export function buildMarriageDossierPdf({dossier,answers,pendingMarriage,legacyChildren=[],parishName,dioceseName}={}){
  const doc=new jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});
  const meta=dossier||{}; const data=answers||{};  header(doc,{dioceseName,parishName,dossierNumber:meta.dossierNumber,pageTitle:'Hoja I · Identificación y entrevista del novio'});
  let y=48;
  y=section(doc,'Identificación del expediente',y);
  const groom=[pendingMarriage?.novioNombres,pendingMarriage?.novioApellidos].filter(Boolean).join(' ');
  const bride=[pendingMarriage?.noviaNombres,pendingMarriage?.noviaApellidos].filter(Boolean).join(' ');
  field(doc,'Novio',groom,18,y,78); field(doc,'Novia',bride,108,y,78); y+=13;
  field(doc,'Fecha del expediente',meta.dossierDate,18,y,50); field(doc,'Fecha prevista matrimonio',meta.plannedMarriageDate,78,y,50); field(doc,'Lugar',meta.ceremonyPlace,138,y,48);
  y=drawPartyIdentification(doc,data.groom,y+14);
  drawInterview(doc,'Entrevista personal del novio',data.groom,y+2,{dioceseName,parishName,dossierNumber:meta.dossierNumber,pageTitle:'Hoja I · Identificación y entrevista del novio'});

  doc.addPage();
  header(doc,{dioceseName,parishName,dossierNumber:meta.dossierNumber,pageTitle:'Hoja II · Identificación y entrevista de la novia'});
  y=drawPartyIdentification(doc,data.bride,48);
  drawInterview(doc,'Entrevista personal de la novia',data.bride,y+2,{dioceseName,parishName,dossierNumber:meta.dossierNumber,pageTitle:'Hoja II · Identificación y entrevista de la novia'});

  doc.addPage();
  header(doc,{dioceseName,parishName,dossierNumber:meta.dossierNumber,pageTitle:'Hoja III · Testigos y documentación'});
  y=48;
  for(const [idx,key] of [[1,'witness1'],[2,'witness2']]){
    if(y>180){
      doc.addPage();
      header(doc,{dioceseName,parishName,dossierNumber:meta.dossierNumber,pageTitle:'Hoja III · Testigos y documentación · continuación'});
      y=48;
    }
    y=section(doc,'Testigo '+idx,y); const w=data[key]||{};
    field(doc,'Nombre',w.name,18,y,78); field(doc,'Documento',w.document,108,y,44); field(doc,'Expedido en',w.documentIssuedAt,156,y,30); y+=11;
    field(doc,'Dirección',w.address,18,y,70); field(doc,'Ciudad',w.city,94,y,44); field(doc,'Teléfono',w.phone,144,y,42); y+=11;
    field(doc,'Conoce al novio desde hace',w.yearsKnownGroom||w.yearsKnown,18,y,78); field(doc,'Conoce a la novia desde hace',w.yearsKnownBride||w.yearsKnown,108,y,78); y+=11;
    field(doc,'Parentesco conocido',w.knowsKinship,18,y,52); field(doc,'Matrimonio anterior conocido',w.knowsPreviousMarriage,76,y,54); field(doc,'Confirma libertad',w.confirmsFreedom,136,y,50); y+=11;
    field(doc,'Presión / coacción',w.knowsCoercion,18,y,52); field(doc,'Conoce verdades de la fe',w.knowsFaith,76,y,54); field(doc,'Padres de acuerdo',w.parentsAgree,136,y,50); y+=11;
    field(doc,'Credibilidad',w.credibility,18,y,52); field(doc,'Algo más que declarar',w.hasAdditionalDeclaration,76,y,54); y+=11;
    field(doc,'Declaración adicional / observaciones',w.observations,18,y,168); y+=17;
  }
  if(y>245){
    doc.addPage();
    header(doc,{dioceseName,parishName,dossierNumber:meta.dossierNumber,pageTitle:'Hoja III · Documentación · continuación'});
    y=48;
  }
  if((legacyChildren||[]).length){
    y=section(doc,'Hijos recuperados del expediente legacy',y);
    for(const child of legacyChildren){
      if(y>258){
        doc.addPage();
        header(doc,{dioceseName,parishName,dossierNumber:meta.dossierNumber,pageTitle:'Hoja III · Hijos y documentación · continuación'});
        y=section(doc,'Hijos recuperados del expediente legacy · continuación',48);
      }
      field(doc,'Nombre',child.child_name,18,y,72);
      field(doc,'Nacimiento',child.birth_date,96,y,34);
      field(doc,'Lugar de Bautismo',child.baptism_place,136,y,50);
      y+=10;
    }
    doc.setFont('helvetica','italic'); doc.setFontSize(6.2); doc.setTextColor(...SLATE);
    doc.text('Información preservada desde DATOSHIJOS del sistema SACRAMENTA.',18,y);
    y+=7;
  }
  y=section(doc,'Documentación verificada',y);
  const docs=data.documents||{};
  const docRows=[['Bautismo novio','groomBaptism'],['Bautismo novia','brideBaptism'],['Confirmación novio','groomConfirmation'],['Confirmación novia','brideConfirmation'],['Curso prematrimonial','premaritalCourse'],['Documentos civiles','civilDocuments'],['Identidad','identityDocuments'],['Proclamas','proclamations'],['Dispensas','dispensations'],['Licencias / permisos','licenses'],['Vínculo anterior','previousMarriageProof'],['Matrimonio mixto / disparidad','mixedMarriageRequirements'],['Otros','other']];
  for(const [label,key] of docRows){
    if(y>258){
      doc.addPage();
      header(doc,{dioceseName,parishName,dossierNumber:meta.dossierNumber,pageTitle:'Hoja III · Documentación · continuación'});
      y=section(doc,'Documentación verificada · continuación',48);
    }
    const h=field(doc,label,docs[key],18,y,168);
    y+=Math.max(8,h);
  }

  doc.addPage();
  header(doc,{dioceseName,parishName,dossierNumber:meta.dossierNumber,pageTitle:'Hoja IV · Valoración canónica y acta'});
  y=48; y=section(doc,'Acta y conclusión canónica',y);
  const act=data.act||{};
  if(act.legacyMarriageDate||act.legacyMarriagePlace||act.legacyMinister){
    field(doc,'Fecha legacy de celebración',act.legacyMarriageDate,18,y,50);
    field(doc,'Lugar legacy de celebración',act.legacyMarriagePlace,76,y,55);
    field(doc,'Ministro legacy',act.legacyMinister,137,y,49);
    y+=13;
  }
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