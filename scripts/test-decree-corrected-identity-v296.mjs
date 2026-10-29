import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nameFromCorrectedRecord, decreeCorrectedTargetName} from '../src/utils/decreeCorrectedName.mjs';

const changed={decreeFormVersion:'V287',targetName:'THIAGO JUNIOR SIERRA REYES',
 newPartidaDraft:{nombres:'THIAGO JOSÉ',apellidos:'SIERRA REYES',
  nombrePadre:'PADRE ACTUALIZADO',nombreMadre:'MADRE ACTUALIZADA'}};

test('V296 archivo e impresión prefieren el nombre corregido de José',()=>{
 assert.equal(decreeCorrectedTargetName(changed,changed.targetName,'bautismo'),
  'THIAGO JOSÉ SIERRA REYES');
 const archive=fs.readFileSync('src/pages/chancery/SacramentalDecreeArchivePage.jsx','utf8');
 assert.match(archive,/decreeCorrectedTargetName\(row\.payload/);
 assert.match(archive,/row\.parish_name/);
 const html=fs.readFileSync('src/services/decreeDocumentHtml.js','utf8');
 assert.match(html,/const proposedName =/);
 assert.match(html,/proposedName \|\| payload\.newTargetName/);
});

test('V296 datos históricos permanecen inalterados',()=>{
 const historical={...changed,decreeFormVersion:'V191'};
 assert.equal(decreeCorrectedTargetName(historical,historical.targetName,'bautismo'),
  'THIAGO JUNIOR SIERRA REYES');
 assert.equal(decreeCorrectedTargetName({targetName:'ORIGINAL'},'ORIGINAL'), 'ORIGINAL');
});

test('V296 los cuatro sacramentos usan nombre completo del registro corregido',()=>{
 assert.equal(nameFromCorrectedRecord({nombres:'MARÍA JOSÉ',apellidos:'GÓMEZ'},'bautismo'),'MARÍA JOSÉ GÓMEZ');
 assert.equal(nameFromCorrectedRecord({nombres:'MARÍA JOSÉ',apellidos:'GÓMEZ'},'confirmacion'),'MARÍA JOSÉ GÓMEZ');
 assert.equal(nameFromCorrectedRecord({nombres:'MARÍA JOSÉ',apellidos:'GÓMEZ'},'exequias'),'MARÍA JOSÉ GÓMEZ');
 assert.equal(nameFromCorrectedRecord({novioNombres:'JUAN JOSÉ',novioApellidos:'RAMOS',
  noviaNombres:'ANA MARÍA',noviaApellidos:'LÓPEZ'},'matrimonio'),
  'JUAN JOSÉ RAMOS Y ANA MARÍA LÓPEZ');
 assert.equal(nameFromCorrectedRecord({nombres:'JUAN'},'bautismo'),'');
});

test('V296 emisión utiliza el nombre nuevo y conserva sin alteraciones los demás campos',()=>{
 const source=fs.readFileSync('src/services/issueDecreeFromFullFormV287.js','utf8');
 assert.match(source,/correctedTargetName=nameFromCorrectedRecord\(record,sacrament\)\|\|targetName\.trim\(\)/);
 assert.match(source,/p_target_name:correctedTargetName/);
 assert.match(source,/p_new_record:record/);
});
