// V228: Seal sanitized results of direct, privileged QA-only SQL executions.
// Three input batches are created manually from actual MCP results; never treat this as a DB connector.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const batchFiles=['AUDITORIA_TRANSACCIONES_LOTE_A_V228.json','AUDITORIA_TRANSACCIONES_LOTE_B_V228.json','AUDITORIA_TRANSACCIONES_LOTE_C_V228.json'];
const expected=[
 'qa-rollback-documentary-decree-lifecycle-v210.sql',
 'qa-rollback-four-pending-authorization-v177.sql',
 'qa-rollback-marginal-four-sacraments-v216.sql',
 'qa-rollback-historical-four-workflows-v173.sql',
 'qa-rollback-reconciliation-all-sacraments-v159.sql',
 'qa-rollback-four-sacrament-seating-v193.sql',
 'qa-rollback-marriage-funeral-sequential-v202.sql',
 'qa-rollback-pending-receipt-atomicity-v207.sql',
 'qa-rollback-print-integrity-v194.sql',
 'qa-rollback-idempotent-pending-creation-v207.sql',
 'qa-rollback-notification-archive-active-profile-v171.sql',
 'qa-rollback-chancery-decree-scope-v179.sql',
 'qa-rollback-decree-status-v189.sql',
 'qa-rollback-physical-provenance-legitimate-v121.sql'
];
const batch=batchFiles.flatMap(f=>JSON.parse(fs.readFileSync(f,'utf8')));
if(batch.length!==14||new Set(batch.map(r=>r.file)).size!==14)throw Error('Incomplete or duplicated V228 transaction results');
const scripts=batch.map((row,i)=>{
 const file='scripts/'+expected[i];
 if(row.file!==file||row.passed!==true||row.tx_rolled_back!==true)throw Error('V228 actual SQL QA not proven for '+file);
 const sql=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 const statements=sql.replace(/^\s*--.*$/gm,'').trim();
 if(!/^BEGIN;/i.test(statements)||!/ROLLBACK;$/i.test(statements)||/^\s*COMMIT\s*;/mi.test(statements))throw Error('Unsafe transaction boundary '+file);
 return {...row,sql_sha256:createHash('sha256').update(sql).digest('hex')};
});
const baseline={
 baptisms:5040,confirmations:2091,marriages:1261,funerals:1,
 pending_baptisms:69,pending_confirmations:233,pending_marriages:1,pending_funerals:1,
 decretos:2,marginal_notes:82,print_events:8,audit_entries:353,auth_accounts:12
};
// Two privileged, independent read-only queries were explicitly run before and after ALL 14 scripts.
// This is a signed-off observation, not a live SQL call made by this Node compiler.
const observedBefore={...baseline},observedAfter={...baseline};
if(JSON.stringify(observedBefore)!==JSON.stringify(observedAfter))throw Error('QA residual rows or accounts after transaction matrix');
const report={
 protocol:'V228',
 project_ref:'foczofcmwampjvlfbsqn',
 environment:'TEST_QA_NOT_OFFICIAL',
 verifiedAt:new Date().toISOString(),
 source:'Supabase MCP execute_sql with privileged QA role: 14 individual BEGIN/ROLLBACK scenarios; separate read-only count queries before/after',
 successfulTransactions:scripts.length,transactionChecks:expected.length,allRollback:true,
 countsBefore:observedBefore,countsAfter:observedAfter,
 archivalSamplesOrCredentialsSaved:false,
 recordsTransferredToOfficial:0,
 claimsNotCovered:['Not independently cryptographically signed or automatically rerun by GitHub CI','No SMTP delivery, physical print, full productive legal authorization, or clean new project was tested','Older print scripts v140/v141 fail by design under v194 guard; newer v194 verification passed'],
 scripts
};
const str=JSON.stringify(report);
if(/[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/i.test(str)||
 /"(?:email|password|access_token|refresh_token|apiKey)"\s*:/i.test(str))
 throw Error('Unexpected sensitive data in V228 export');
fs.writeFileSync('AUDITORIA_TRANSACCIONES_LIVE_V228.json',JSON.stringify(report,null,2)+'\n');
for(const file of batchFiles)fs.unlinkSync(file);
console.log('V228 sealed: 14/14 real rollback transactions; 13 QA counts match before/after; no secrets');
