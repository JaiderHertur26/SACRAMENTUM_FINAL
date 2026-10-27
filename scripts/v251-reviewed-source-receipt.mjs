// V251: preserve immutable V205-V207 browser reports while pinning reviewed UI-only changes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const receipt=JSON.parse(fs.readFileSync('AUDITORIA_V251_REVISIÓN_SOLO_ETIQUETAS.json','utf8'));
export function assertV251RevisedSource({file,historicalSha256,currentSha256}){
 const update=receipt.reviewedSourceSha256[file];
 if(!update){
  assert.equal(currentSha256,historicalSha256,'Unexpected source change: '+file);
  return;
 }
 assert.ok(receipt.approvedSourceFiles.includes(file),'Source not approved for V251: '+file);
 assert.equal(update.before,historicalSha256,'Historical browser receipt altered: '+file);
 assert.equal(currentSha256,update.after,'V251 reviewed source changed without evidence: '+file);
 assert.ok(update.editedLines>=1);
}
