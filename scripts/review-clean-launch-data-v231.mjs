import fs from 'node:fs';
import {report} from './audit-production-migration-safety-v231.mjs';

const knownTemplateDestinations=new Set([
 'public.legacy_import_profiles',
 'public.marginal_note_templates',
 'public.marginal_note_template_clauses',
 '_v74_document_rewrites',
 'public.document_templates'
]);
const actual=report();
const writeStatements=[];
for(const f of actual.findings){
 for(const action of f.actions){
  const dest=action.head.match(/^insert\s+into\s+([A-Za-z0-9_.]+)/i)?.[1]?.toLowerCase();
  const catalogAllowlist=action.kind==='INSERT INTO' && knownTemplateDestinations.has(dest);
  const kind= catalogAllowlist ? 'REFERENCE_TEMPLATE_CANDIDATE_REQUIRES_REVIEW' :
      f.file.includes('v83_decree_concepts') && dest==='public.conceptos_anulacion'
      ? 'QA_LEGACY_CATALOG_DIocese_ANCHOR_MUST_EXCLUDE'
      : /legacy_marginal_template_snapshots/.test(action.head)
      ? 'DATA_COPY_FROM_QA_TABLE_MUST_EXCLUDE'
      : 'HISTORICAL_DATA_MUTATION_MUST_EXCLUDE';
  writeStatements.push({file:f.file,sha256:f.sha256,statementIndex:action.statementIndex,
    kind:action.kind,destination:dest??null,launchPolicy:kind});
 }
}
const summary={
 allMigrations:actual.migrationCount,
 migrationsWithDirectDataStatements:actual.directWriteMigrationCount,
 directDataStatements:writeStatements.length,
 referenceTemplateCandidates:writeStatements.filter(x=>x.launchPolicy==='REFERENCE_TEMPLATE_CANDIDATE_REQUIRES_REVIEW').length,
 blockedDataStatements:writeStatements.filter(x=>x.launchPolicy!=='REFERENCE_TEMPLATE_CANDIDATE_REQUIRES_REVIEW').length,
 explicitQaAnchoredConcepts:writeStatements.filter(x=>x.launchPolicy.includes('QA_LEGACY_CATALOG')).length,
 hiddenMigrationSideEffectsNotStaticallyCertified:true
};
if(summary.allMigrations!==158||summary.directDataStatements!==45||
 summary.referenceTemplateCandidates!==6||summary.blockedDataStatements!==39||
 summary.explicitQaAnchoredConcepts!==1)
 throw Error('Unexpected historical migration contents; audit each change before clean launch');
const result={
 protocol:'V231',scope:'158 historical QA migrations; offline structural-data inventory ONLY',
 source:'SQL code lexer excludes PLpgSQL dollar-quoted bodies, comments, string literals and classifies top-level direct DML by hand-reviewed destination allowlist',
 fullyCertifiedForCleanProductionReplay:false,
 canCopyExistingQaDatabase:false,
 approvedForOfficialMode:false,
 summary,
 bannedQaSourcePatterns:[
  'CPTOANULA.DBF external legacy catalog references and UUID-specific original diocese seeds',
  'legacy_marginal_template_snapshots copied from QA parish parameters',
  'registry_audit_log backfills and cleanup of known QA-only territory UUIDs'
 ],
 note:'Six allowed candidates are NOT automatically approved: schema-compatible default templates must be manually vetted. Other migrations can contain DO blocks, triggers, and function-call side effects not covered by the static lexer. All 158 SQL files require a clean empty-project rehearsal before any certification.',
 releaseBlockingRequirements:[
  'Build new clean schema baseline without replaying historical mutation statements into real data',
  'Do NOT transplant auth users, old QA business records, legacy data, decree/audit history, or source snapshots',
  'Verify clean project has zero registry user, audit and imported historical rows after schema provisioning',
  'Resolve supabase_admin future default ACLs, 152 privileged RPC reviews, SMTP and backup restoration before real entries'
 ],
 entries:writeStatements
};
fs.writeFileSync('AUDITORIA_MIGRACIONES_LANZAMIENTO_LIMPIO_V231.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(summary));
