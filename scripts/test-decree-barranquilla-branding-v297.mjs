import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDecreeDocumentHtml } from '../src/services/decreeDocumentHtml.js';
import { buildDocumentaryDecreeHtml } from '../src/services/decreeDocumentaryHtml.mjs';
import { isBarranquillaChanceryDecree } from '../src/utils/decreeInstitutionBranding.mjs';
import { BARRANQUILLA_DIOCESE_ID, BARRANQUILLA_CREST } from '../src/lib/institutionalBranding.js';

const base = {
  id:'00000000-0000-4000-8000-000000000001',
  diocese_id:BARRANQUILLA_DIOCESE_ID,
  tipo:'correccion',sacrament_type:'bautismo',
  decree_number:'DECRETO 002',decree_date:'2026-10-27',
  payload:{
    targetName:'THIAGO JUNIOR SIERRA REYES',
    newPartidaDraft:{ nombres:'THIAGO JOSÉ',apellidos:'SIERRA REYES',
      fechaSacramento:'2024-12-13',nombrePadre:'PADRE',nombreMadre:'MADRE'},
    originalPartidaSummary:{book:'0001',page:'0429',entry:'0858'},
    issuingSigner:{office:'vice_canciller',name:'PBRO. JULIÁN MOGOLLÓN MOGOLLÓN'},
    reason:'SE CAMBIÓ EL SEGUNDO NOMBRE'
  }
};
const clone=()=>structuredClone(base);
const ctx={institution:{dioceseName:'Otra diócesis',officeName:'OFICINA DE CANCILLERÍA'},
 parish:{name:'Parroquia Santa Cruz'}};
const html=row=>buildDecreeDocumentHtml({row,...ctx,autoPrint:false});

test('V297 usa el escudo vectorial ya existente',()=>{
 assert.equal(BARRANQUILLA_CREST,'/barranquilla-archdiocese-crest.svg');
 assert.ok(fs.existsSync('public/barranquilla-archdiocese-crest.svg'));
 assert.match(fs.readFileSync('public/barranquilla-archdiocese-crest.svg','utf8'),/#D4AA51/);
});

test('V297 logo en Canciller y Vicecanciller de Barranquilla incluso al leer desde otra parroquia',()=>{
 for(const office of ['canciller','vice_canciller']){
   const row=clone();row.payload.issuingSigner.office=office;
   assert.equal(isBarranquillaChanceryDecree(row),true);
   const doc=html(row);
   assert.match(doc,/class="archdiocese-crest"/);
   assert.ok(doc.includes('src="/barranquilla-archdiocese-crest.svg"'));
   assert.match(doc,/ARQUIDIÓCESIS DE BARRANQUILLA/);
   assert.match(doc,/THIAGO JOSÉ SIERRA REYES/);
 }
});

test('V297 sin escudo para otra diócesis aun si la cabecera dice Barranquilla',()=>{
 const row=clone();row.diocese_id='11111111-1111-4111-8111-111111111111';
 const doc=buildDecreeDocumentHtml({row,
   institution:{dioceseName:'ARQUIDIÓCESIS DE BARRANQUILLA'}});
 assert.equal(isBarranquillaChanceryDecree(row),false);
 assert.doesNotMatch(doc,/class="archdiocese-crest"/);
});

test('V297 no confunde un lector parroquial con un emisor de Cancillería',()=>{
 const row=clone(); delete row.payload.issuingSigner;
 assert.equal(isBarranquillaChanceryDecree(row),false);
 assert.doesNotMatch(html(row),/class="archdiocese-crest"/);
});

test('V297 el mismo espacio para firmar corrección y reposición',()=>{
 for(const tipo of ['correccion','reposicion']){
  const row=clone();row.tipo=tipo;
  const doc=html(row);
  assert.match(doc,/padding-top:21mm;break-inside:avoid/);
  assert.match(doc,/class="signature-row"/);
  assert.match(doc,/VICECANCILLER ARQUIDIOCESANO/);
  assert.doesNotMatch(doc,/class="seal"/);
 }
});

test('V297 también aplica identidad a decretos documentales nuevos, nunca históricos',()=>{
 const row=clone(); row.tipo='documental';
 assert.match(buildDocumentaryDecreeHtml({row,...ctx}),/class="institutional-crest"/);
 row.payload.historical=true;
 assert.doesNotMatch(buildDocumentaryDecreeHtml({row,...ctx}),/class="institutional-crest"/);
});

test('V297 ambos accesos siguen usando la misma plantilla para PDF y vista parroquial',()=>{
 const parish=fs.readFileSync('src/pages/parish/ParishDecreeDetailPage.jsx','utf8');
 const archive=fs.readFileSync('src/pages/chancery/SacramentalDecreeArchivePage.jsx','utf8');
 assert.match(parish,/srcDoc=\{previewHtml\}/);
 assert.match(parish,/buildDecreeDocumentHtml\(/);
 assert.match(archive,/buildDecreeDocumentHtml\(/);
});
