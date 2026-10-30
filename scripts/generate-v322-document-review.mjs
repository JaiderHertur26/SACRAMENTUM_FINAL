import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {buildDecreeDocumentHtml} from '../src/services/decreeDocumentHtml.js';
import {buildSacramentalBookPdf,buildSacramentalIndexPdf} from '../src/services/sacramentalBookPdf.js';
const out=path.resolve('AUDITORIA_EVIDENCIAS_V322');
fs.mkdirSync(out,{recursive:true});
const dioceseName='ARQUIDIÓCESIS DE BARRANQUILLA';
const parishName='PARROQUIA FICTICIA DE VALIDACIÓN';
const common={book_number:'31',folio:'442',status:'seated',celebration_date:'2026-10-24',nombres:'MARÍA',apellidos:'FICTICIA',nombre_padre:'PADRE FICTICIO',nombre_madre:'MADRE FICTICIA',raw_data:{fechaNacimiento:'2010-06-03',padrinos:'PADRINO FICTICIO',cementerio:'CEMENTERIO FICTICIO'}};
const rows={
 bautismo:{...common,nombres:'ANA MARÍA',number:'101'},
 confirmacion:{...common,nombres:'PEDRO JOSÉ',number:'102'},
 matrimonio:{...common,groomName:'JUAN',groomSurname:'EJEMPLO',brideName:'MARÍA',brideSurname:'FICTICIA',number:'103'},
 exequias:{...common,nombres:'ROSA',fecha_defuncion:'2026-10-20',fecha_exequias:'2026-10-24',number:'104'}
};
const manifest=[];
for(const [s,r] of Object.entries(rows)){
 const opts={records:[r],sacrament:s,parishName,dioceseName,book:'31',period:'2026'};
 for(const [kind,fn] of [['LIBROS',buildSacramentalBookPdf],['INDICES',buildSacramentalIndexPdf]]){
  const dir=path.join(out,kind);fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,kind.toLowerCase()+'-'+s+'-v322.pdf');
  fs.writeFileSync(file,Buffer.from(fn(opts).output('arraybuffer')));
  manifest.push({file:path.relative(out,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,kind,s,origin:'src/services/sacramentalBookPdf.js',fictitious:true});
 }
}
const sign={issuingSigner:{office:'canciller',name:'CANCILLER FICTICIO QA'}};
const docs={
 correccion:{tipo:'correccion',sacrament_type:'bautismo',decree_number:'QA-V322-COR-001',decree_date:'2026-10-30',payload:{targetName:'ANA MARÍA FICTICIA',originalPartidaSummary:{book:'31',page:'442',entry:'101'},newPartidaDraft:{nombres:'ANA MARÍA',apellidos:'FICTICIA',fechaSacramento:'2026-10-24',fechaNacimiento:'2010-06-03',nombrePadre:'PADRE FICTICIO',nombreMadre:'MADRE FICTICIA'},newPartidaSummary:{book:'SUP-31',page:'1',entry:'1'},reason:'CORRECCIÓN FICTICIA DE SEGUNDO NOMBRE.',...sign}},
 reposicion:{tipo:'reposicion',sacrament_type:'confirmacion',decree_number:'QA-V322-REP-002',decree_date:'2026-10-30',payload:{targetName:'PEDRO JOSÉ FICTICIO',newPartidaDraft:{nombres:'PEDRO JOSÉ',apellidos:'FICTICIO',fechaSacramento:'2026-10-24'},newPartidaSummary:{book:'SUP-31',page:'2',entry:'2'},reason:'REPOSICIÓN FICTICIA POR PÉRDIDA DOCUMENTAL.',evidence:{type:'CERTIFICADO',reference:'QA-EVID-02',issuer:'ARCHIVO DE ENSAYO',date:'2026-10-29'},...sign}},
 repeticion:{tipo:'repeticion',sacrament_type:'bautismo',decree_number:'QA-V322-REPET-003',decree_date:'2026-10-30',payload:{targetName:'PERSONA FICTICIA REPETIDA',reason:'COEXISTENCIA FICTICIA DE TRES PARTIDAS.',evidenceRef:'QA-EXP-03',instruction:'REGISTRAR LA CONSTANCIA EN CADA PARROQUIA.',repetitionWorkflowStatus:'completed_documentary',signerName:'CANCILLER FICTICIO',signerTitle:'CANCILLER ARQUIDIOCESANO',affectedEntries:[{parishName:'PARROQUIA FICTICIA A',book:'12',folio:'35',number:'15',disposition:'without_effect',justification:'DUPLICADO FICTICIO'},{parishName:'PARROQUIA FICTICIA B',book:'13',folio:'36',number:'16',disposition:'retain',justification:'REGISTRO ACREDITATIVO FICTICIO'},{parishName:'PARROQUIA FICTICIA C',book:'14',folio:'37',number:'17',disposition:'without_effect',justification:'DUPLICADO FICTICIO'}]}},
 documental:{tipo:'documental',sacrament_type:'matrimonio',decree_number:'QA-V322-DOC-004',decree_date:'2026-10-30',payload:{targetName:'PAREJA FICTICIA',reason:'ACTUACIÓN DOCUMENTAL DE ENSAYO. NO MODIFICA PARTIDAS.'}},
 historico:{tipo:'documental',sacrament_type:'exequias',decree_number:'QA-V322-HIST-005',decree_date:'2001-01-01',payload:{historical:true,targetName:'PERSONA FICTICIA HISTÓRICA',reason:'TRANSCRIPCIÓN HISTÓRICA SIMULADA.',sourceReference:'ARCHIVO FICTICIO QA'}}
};
const chrome=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!chrome)throw Error('No Chrome');
const crest=fs.readFileSync('public/barranquilla-archdiocese-crest.svg').toString('base64');
const dir=path.join(out,'DECRETOS');fs.mkdirSync(dir,{recursive:true});
for(const [kind,row] of Object.entries(docs)){
 let html=buildDecreeDocumentHtml({row,institution:{dioceseName,officeName:'CANCILLERÍA'},parish:{name:parishName,city:'Barranquilla'},autoPrint:false});
 html=html.replaceAll('src="/barranquilla-archdiocese-crest.svg"','src="data:image/svg+xml;base64,'+crest+'"');
 html=html.replace('</head>','<style>@media print{body:before{content:"EVIDENCIA FICTICIA - SIN VALIDEZ";position:fixed;z-index:999;top:19%;left:9%;transform:rotate(-30deg);color:rgba(140,40,40,.12);font:bold 37px Arial;pointer-events:none}}</style></head>');
 const h=path.join(dir,'decreto-'+kind+'-v322.html'),pdf=path.join(dir,'decreto-'+kind+'-v322.pdf');
 fs.writeFileSync(h,html);
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'v322-pdf-'));
 const r=spawnSync(chrome,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--no-pdf-header-footer','--user-data-dir='+profile,'--print-to-pdf='+pdf,'file:///'+h.replaceAll('\\','/')],{timeout:25000,encoding:'utf8',windowsHide:true});
 try{fs.rmSync(profile,{recursive:true,force:true})}catch{}
 if(r.status!==0||!fs.existsSync(pdf)||fs.statSync(pdf).size<4000)throw Error('PDF fallo '+kind+' '+r.status+' '+String(r.stderr).slice(-400));
 manifest.push({file:path.relative(out,pdf).replaceAll('\\','/'),bytes:fs.statSync(pdf).size,kind:'DECRETO',s:kind,origin:'src/services/decreeDocumentHtml.js',fictitious:true});
}
fs.writeFileSync(path.join(out,'manifest-ejemplos.json'),JSON.stringify({generatedAt:new Date().toISOString(),origin:'Plantillas reales, datos 100% ficticios',items:manifest},null,2));
console.log('V322 '+manifest.length+' PDFs '+manifest.map(x=>x.file+':'+x.bytes).join(' '));
