import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BARRANQUILLA_DIOCESE_ID, isBarranquillaInstitutionalUser } from '../src/lib/institutionalBranding.js';
const candidate = (overrides={}) => ({
  is_active:true,status:'ACTIVE',brandingDioceseId:BARRANQUILLA_DIOCESE_ID,role:'diocese',...overrides
});
test('brand V186: arches, chancery and parish institutional roles show crest', () => {
  for (const role of ['diocese','chancery','parish']) assert.equal(isBarranquillaInstitutionalUser(candidate({role})),true,role);
});
test('brand V186: other diocese, no scope and admin general never show crest', () => {
  assert.equal(isBarranquillaInstitutionalUser(candidate({brandingDioceseId:'b34fc000-0000-4000-a000-000000000000'})),false);
  assert.equal(isBarranquillaInstitutionalUser(candidate({brandingDioceseId:null})),false);
  assert.equal(isBarranquillaInstitutionalUser(candidate({role:'admin_general'})),false);
});
test('brand V186: inactive, null-state, pending or profileless do not show crest', () => {
  assert.equal(isBarranquillaInstitutionalUser(candidate({is_active:false})),false);
  assert.equal(isBarranquillaInstitutionalUser(candidate({status:null})),false);
  assert.equal(isBarranquillaInstitutionalUser(candidate({status:'PENDING'})),false);
  assert.equal(isBarranquillaInstitutionalUser(null),false);
});
test('brand V186: user editable metadata must never select emblem', () => {
  const fake=candidate({brandingDioceseId:null,user_metadata:{dioceseId:BARRANQUILLA_DIOCESE_ID}});
  assert.equal(isBarranquillaInstitutionalUser(fake),false);
});

test('brand V186: real login swaps old heading for uploaded jurisdiction crest',()=>{
  const login=fs.readFileSync('src/pages/PublicSearchPage.jsx','utf8');
  assert.ok(login.includes('BARRANQUILLA_CREST'));
  assert.ok(login.includes('BARRANQUILLA_NAME') || login.includes('Arquidiócesis<br />de Barranquilla'));
  assert.ok(!login.includes('Plataforma Eclesial'));
  const asset=fs.readFileSync('public/barranquilla-archdiocese-crest.svg','utf8');
  assert.ok(asset.includes('viewBox="0 0 760 1378"'));
});
test('brand V186: all institutional dashboards share a persistent sidebar identity',()=>{
  const sidebar=fs.readFileSync('src/components/Sidebar.jsx','utf8');
  assert.ok(sidebar.includes('showBarranquillaIdentity && ('));
  assert.ok(sidebar.includes('src={BARRANQUILLA_CREST}'));
  assert.ok(sidebar.includes('BARRANQUILLA_NAME'));
  const auth=fs.readFileSync('src/context/AuthContext.jsx','utf8');
  assert.ok(auth.includes(".from('parishes').select('name,diocese_id')"));
  assert.ok(auth.includes(".from('dioceses').select('id,name')"));
  assert.ok(auth.includes('brandingDioceseId = data?.id || null'));
});
