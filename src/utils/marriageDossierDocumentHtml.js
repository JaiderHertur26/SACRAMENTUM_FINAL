const esc=(v)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
const show=(v)=>esc(v||'—');
const row=(label,value)=>`<div class="row"><span>${esc(label)}</span><strong>${show(value)}</strong></div>`;
const yn=(v)=>show(v);
const canonicalLabel=(v)=>({
  both_catholic_baptized:'Matrimonio entre católicos bautizados',
  mixed_marriage:'Matrimonio mixto',
  disparity_of_cult:'Disparidad de culto',
  other_or_undetermined:'Otra situación / por determinar'
}[v]||'—');

const page=(title,subtitle,body,pageNo)=>`
<section class="page">
  <header>
    <div class="cross">✝</div>
    <div>
      <div class="kicker">EXPEDIENTE MATRIMONIAL</div>
      <h1>${esc(title)}</h1>
      <p>${esc(subtitle||'')}</p>
    </div>
    <div class="pageNo">Hoja ${pageNo}</div>
  </header>
  ${body}
  <footer>
    <span>Documento pastoral interno · SACRAMENTUM</span>
    <span>Hoja ${pageNo} de 4</span>
  </footer>
</section>`;

const partyInterview=(p,title)=>`
  <h2>${esc(title)}</h2>
  <div class="grid">
    ${row('Nombre completo',p.fullName)}
    ${row('Documento',p.documentId)}
    ${row('Expedido en',p.documentIssuedAt)}
    ${row('Nacimiento',[p.birthDate,p.birthPlace].filter(Boolean).join(' · '))}
    ${row('Padre',p.father)}
    ${row('Madre',p.mother)}
    ${row('Ocupación',[p.occupation,p.employer].filter(Boolean).join(' · '))}
    ${row('Residencia',[p.residenceAddress,p.residenceCity].filter(Boolean).join(' · '))}
    ${row('Teléfonos',p.phones)}
    ${row('Condición bautismal',p.baptismStatus)}
    ${row('Referencia de Bautismo',p.baptismReference)}
    ${row('Confirmación',[p.confirmationStatus,p.confirmationPlace].filter(Boolean).join(' · '))}
  </div>
  <h3>Entrevista del sacerdote</h3>
  <div class="questions">
    ${row('Tiempo de noviazgo',p.datingDuration)}
    ${row('¿Existe parentesco?',yn(p.kinship))}
    ${row('¿Conviven actualmente en unión libre?',yn(p.cohabitation))}
    ${p.cohabitation==='SÍ'?row('Tiempo de convivencia',p.cohabitationDuration):''}
    ${row('¿Ha pertenecido o pertenece a otra religión?',yn(p.otherReligion))}
    ${p.otherReligion==='SÍ'?row('Religión / confesión',p.religion):''}
    ${row('¿Conoce las principales verdades de la fe?',yn(p.knowsFaithTruths))}
    ${row('¿Comprende que el matrimonio católico es sacramento?',yn(p.understandsSacrament))}
    ${row('¿Acepta unidad e indisolubilidad?',yn(p.acceptsUnityIndissolubility))}
    ${row('¿Acepta que el matrimonio es para toda la vida?',yn(p.acceptsLifelongMarriage))}
    ${row('¿Asume la responsabilidad de formar una familia?',yn(p.acceptsFamilyResponsibility))}
    ${row('¿Ha condicionado su consentimiento matrimonial?',yn(p.conditionedMarriage))}
    ${row('¿Se casa con entera libertad y conocimiento?',yn(p.freeAndInformedConsent))}
    ${row('¿Está de acuerdo su familia?',yn(p.familyApproval))}
    ${row('¿Ha convivido antes en unión libre con otra persona?',yn(p.previousCohabitation))}
    ${row('¿Ha contraído matrimonio anteriormente?',p.previousMarriage)}
    ${row('Matrimonio católico anterior',p.previousCatholicMarriage)}
    ${row('Matrimonio civil anterior',p.previousCivilMarriage)}
    ${row('Documento de vínculo anterior',[p.priorMarriageDocumentNumber,p.priorMarriageDocumentDate,p.priorMarriageDocumentIssuer].filter(Boolean).join(' · '))}
    ${row('Apertura a los hijos',p.intentionChildren)}
    ${row('¿Tiene algo más que declarar?',p.additionalToDeclare)}
  </div>
  ${p.additionalDeclaration?`<div class="note"><b>Declaración adicional:</b><br/>${esc(p.additionalDeclaration)}</div>`:''}
  ${p.observations?`<div class="note"><b>Observaciones reservadas del sacerdote:</b><br/>${esc(p.observations)}</div>`:''}
  <div class="signatures"><div>Firma del contrayente</div><div>Firma del sacerdote</div></div>
`;

const witnessBlock=(w,title)=>`
<div class="witness">
  <h3>${esc(title)}</h3>
  <div class="grid compact">
    ${row('Nombre',w.name)}
    ${row('Documento',w.document)}
    ${row('Expedido en',w.issuedAt)}
    ${row('Residencia',[w.address,w.city].filter(Boolean).join(' · '))}
    ${row('Teléfono',w.phone)}
    ${row('Relación',w.relationship)}
  </div>
  <div class="questions">
    ${row('¿Hace cuánto conoce al novio?',w.knowsGroomDuration)}
    ${row('¿Hace cuánto conoce a la novia?',w.knowsBrideDuration)}
    ${row('¿Sabe de algún parentesco?',w.knowsKinship)}
    ${row('¿Sabe de matrimonios anteriores?',w.knowsPreviousMarriage)}
    ${row('¿Le consta que ambos se casan libres?',w.confirmsFreedom)}
    ${row('¿Le consta que no existe presión?',w.confirmsNoPressure)}
    ${row('¿Le consta que conocen las verdades de la fe?',w.knowsFaithTruths)}
    ${row('¿Las familias están de acuerdo?',w.familiesAgree)}
    ${row('¿Tiene algo más que declarar?',w.additionalToDeclare)}
  </div>
  ${w.additionalDeclaration?`<div class="note"><b>Declaración adicional:</b><br/>${esc(w.additionalDeclaration)}</div>`:''}
  ${w.observations?`<div class="note"><b>Observaciones:</b><br/>${esc(w.observations)}</div>`:''}
</div>`;

export function buildMarriageDossierHtml({meta={},answers={},pendingMarriage=null,institution={}}={}){
  const groom=answers.groom||{}, bride=answers.bride||{}, w1=answers.witness1||{}, w2=answers.witness2||{};
  const auth=answers.authorization||{}, docs=answers.documents||{}, act=answers.act||{}, children=Array.isArray(answers.children)?answers.children:[];
  const couple=[groom.fullName,bride.fullName].filter(Boolean).join(' + ') || [
    [pendingMarriage?.novioNombres,pendingMarriage?.novioApellidos].filter(Boolean).join(' '),
    [pendingMarriage?.noviaNombres,pendingMarriage?.noviaApellidos].filter(Boolean).join(' ')
  ].filter(Boolean).join(' + ');
  const common=`
    <div class="institution"><b>${show(institution.parishName||'Parroquia')}</b><br/>${show(institution.dioceseName||'')}</div>
    <div class="grid">
      ${row('Expediente',meta.dossierNumber)}
      ${row('Fecha del expediente',meta.dossierDate)}
      ${row('Fecha prevista del matrimonio',meta.plannedMarriageDate)}
      ${row('Lugar de celebración',meta.ceremonyPlace)}
      ${row('Contrayentes',couple)}
      ${row('Situación canónica',canonicalLabel(answers.canonicalMarriageCategory))}
    </div>`;
  const p1=page('Entrevista del contrayente',couple,`${common}${partyInterview(groom,'Datos y entrevista del novio')}`,1);
  const p2=page('Entrevista de la contrayente',couple,`${common}${partyInterview(bride,'Datos y entrevista de la novia')}`,2);
  const p3=page('Testigos del expediente',couple,`${common}${witnessBlock(w1,'Primer testigo')}${witnessBlock(w2,'Segundo testigo')}<div class="signatures"><div>Firma del primer testigo</div><div>Firma del segundo testigo</div><div>Firma del sacerdote</div></div>`,3);
  const childrenHtml=children.length?children.map((c,i)=>`<tr><td>${i+1}</td><td>${show(c.name)}</td><td>${show(c.birthDate)}</td><td>${show(c.baptismPlace)}</td><td>${show(c.notes)}</td></tr>`).join(''):'<tr><td colspan="5">No se registran hijos en el expediente.</td></tr>';
  const p4=page('Acta y verificación documental',couple,`
    ${common}
    <h2>Autorización / dispensa / licencia</h2>
    <div class="grid">
      ${row('Se celebra por decreto / dispensa / licencia',auth.byDecree)}
      ${row('Número',auth.decreeNumber)}
      ${row('Fecha',auth.decreeDate)}
      ${row('Expedido por',auth.decreeIssuer)}
    </div>
    <h2>Documentos verificados</h2>
    <div class="grid">
      ${row('Bautismo del novio',docs.groomBaptism)}
      ${row('Bautismo de la novia',docs.brideBaptism)}
      ${row('Curso prematrimonial',docs.premaritalCourse)}
      ${row('Documentos civiles',docs.civilDocuments)}
      ${row('Dispensas / licencias',docs.dispensations)}
      ${row('Proclamas',docs.proclamations)}
      ${row('Otros documentos',docs.other)}
    </div>
    <h2>Hijos</h2>
    <table><thead><tr><th>#</th><th>Nombre</th><th>Nacimiento</th><th>Lugar de Bautismo</th><th>Observaciones</th></tr></thead><tbody>${childrenHtml}</tbody></table>
    <h2>Acta / conclusión</h2>
    <div class="note"><b>Declaración:</b><br/>${show(act.declaration)}</div>
    <div class="note"><b>Observaciones finales:</b><br/>${show(act.observations)}</div>
    <div class="note"><b>Certificación del párroco:</b><br/>${show(act.pastorCertification)}</div>
    <div class="signatures"><div>Firma del contrayente</div><div>Firma de la contrayente</div><div>Firma del párroco / sacerdote delegado</div></div>
  `,4);
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Expediente Matrimonial ${esc(meta.dossierNumber||'')}</title><style>
  @page{size:Letter;margin:0}
  *{box-sizing:border-box} body{margin:0;background:#eceff3;color:#172033;font-family:Arial,Helvetica,sans-serif}
  .page{width:8.5in;min-height:11in;margin:0 auto 18px;background:#fff;padding:.42in .52in .45in;position:relative;page-break-after:always}
  .page:last-child{page-break-after:auto}
  header{display:grid;grid-template-columns:48px 1fr auto;gap:12px;align-items:center;border-bottom:2px solid #1f4d73;padding-bottom:12px;margin-bottom:14px}
  .cross{font-size:30px;color:#b28a2e;text-align:center}.kicker{font-size:9px;font-weight:900;letter-spacing:.22em;color:#587792}
  h1{font-family:Georgia,serif;font-size:24px;margin:2px 0;color:#15283d} header p{margin:0;font-size:10px;color:#64748b}.pageNo{font-size:10px;font-weight:800;color:#64748b}
  .institution{text-align:center;background:#f8fafc;border:1px solid #dce5ee;border-radius:10px;padding:8px;margin-bottom:12px;font-size:11px}
  h2{font-family:Georgia,serif;font-size:16px;color:#1f4d73;margin:15px 0 7px;border-bottom:1px solid #dbe4ec;padding-bottom:5px}
  h3{font-size:12px;color:#8a6d12;margin:13px 0 7px;text-transform:uppercase;letter-spacing:.08em}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}.grid.compact{gap:4px 12px}
  .row{display:grid;grid-template-columns:44% 56%;gap:6px;border-bottom:1px dotted #ccd5df;padding:4px 0;font-size:9.5px}.row span{color:#64748b}.row strong{font-weight:700}
  .questions{margin-top:5px}.questions .row{grid-template-columns:68% 32%}
  .note{border:1px solid #d9e1e8;background:#fbfcfd;border-radius:8px;padding:8px;margin-top:8px;font-size:9.5px;white-space:pre-wrap}
  .witness{border:1px solid #dbe4ec;border-radius:12px;padding:10px;margin-bottom:12px}
  .signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:28px}.signatures div{border-top:1px solid #475569;padding-top:5px;text-align:center;font-size:9px}
  table{width:100%;border-collapse:collapse;font-size:8.8px} th,td{border:1px solid #d6dee6;padding:5px;text-align:left} th{background:#f1f5f9;color:#475569}
  footer{position:absolute;left:.52in;right:.52in;bottom:.22in;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:5px;font-size:8px;color:#94a3b8}
  @media print{body{background:#fff}.page{margin:0;box-shadow:none}}
  </style></head><body>${p1}${p2}${p3}${p4}<script>window.onload=()=>window.print();</script></body></html>`;
}
