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
  // GitHub's browser jobs regenerate a fresh V205/V206/V207 report before
  // synthetic tests. A freshly regenerated report legitimately contains V264
  // source SHA; archived reports still contain V251/baseline SHA. Both must
  // resolve to the same pinned, reviewed V264 current source.
  const acceptedBrowserHashes=preceding
    ? [preceding.before,preceding.after,newer.after]
    : [newer.previousSourceSha256,newer.after];
  assert.ok(acceptedBrowserHashes.includes(historicalSha256),
    'V264 browser evidence neither a historic approved source nor reviewed current source: '+file);
  if(preceding) assert.equal(newer.previousSourceSha256,preceding.after,
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
