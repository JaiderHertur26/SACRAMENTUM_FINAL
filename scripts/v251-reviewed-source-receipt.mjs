// V251: preserve immutable V205-V207 browser reports while pinning reviewed UI-only changes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const receipt=JSON.parse(fs.readFileSync('AUDITORIA_V251_REVISIÓN_SOLO_ETIQUETAS.json','utf8'));
// V264 is a separate, reviewed source revision; V205-V207/V251 archives remain immutable.
const v264=JSON.parse(fs.readFileSync('AUDITORIA_V264_REVISION_UI_ASIENTOS.json','utf8'));
const approvedV264=['BaptismSentarRegistrosPage.jsx','ConfirmationSentarRegistrosPage.jsx',
 'MatrimonioSentarRegistrosPage.jsx','FuneralRegistryPage.jsx']
 .map(name=>'src/pages/parish/'+name);
export function assertV251RevisedSource({file,historicalSha256,currentSha256}){
 const newer=v264.reviewedSourceSha256[file];
 if(newer){
  assert.ok(approvedV264.includes(file),'Unapproved V264 source: '+file);
  const preceding=receipt.reviewedSourceSha256[file];
  assert.ok(preceding ? [preceding.before,preceding.after].includes(historicalSha256)
    : newer.previousSourceSha256===historicalSha256,
    'V264 historical browser baseline mismatch: '+file);
  assert.equal(newer.previousSourceSha256,preceding?.after||historicalSha256,
    'V264 predecessor source differs from reviewed V251 version: '+file);
  assert.equal(currentSha256,newer.after,'V264 UI modified without independent source review: '+file);
  return;
 }
 const update=receipt.reviewedSourceSha256[file];
 if(!update){
  assert.equal(currentSha256,historicalSha256,'Unexpected source change: '+file);
  return;
 }
 assert.ok(receipt.approvedSourceFiles.includes(file),'Source not approved for V251: '+file);
 assert.ok([update.before,update.after].includes(historicalSha256),
  'Browser evidence hash differs from both the immutable historic receipt and the reviewed V251 replay: '+file);
 assert.equal(currentSha256,update.after,'V251 reviewed source changed without evidence: '+file);
 assert.ok(update.editedLines>=1);
}
