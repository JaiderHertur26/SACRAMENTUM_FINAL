// BUILD-SAFE constant: scripts/ and supabase/ are intentionally absent from Vercel bundle.
// This digest is anchored to 158 reviewed migration file hashes in
// AUDITORIA_MIGRACIONES_DATOS_V231.json, checked against actual migration files by CI.
// It is an accident-prevention control; it cannot replace DB restore or a signed DBA review.
export const HISTORICAL_MIGRATION_MANIFEST_SHA256='dacb5e74026bebb8d92ae7ba10f6a9c5de609da248f366ea7a8d735e4065ace5';
export const CLEAN_REPLAY_HISTORICAL_MIGRATIONS=159;
export const CLEAN_REPLAY_MUTATIONS_TO_EXCLUDE=39;
export const CLEAN_REPLAY_REFERENCE_CATALOGS_TO_REVIEW=6;

export function assessCleanReplayEvidenceV231(evidence){
 const problems=[];
 if(!evidence||typeof evidence!=='object')return ['falta acta de reproducción estructural limpia'];
 if(evidence.status!=='CLEAN_SCHEMA_REPLAY_VERIFIED')problems.push('reproducción de esquema limpio no certificada');
 if(evidence.migration_manifest_sha256!==HISTORICAL_MIGRATION_MANIFEST_SHA256)
  problems.push('catálogo de migraciones históricas distinto al auditado');
 if(evidence.historical_migrations_reviewed!==CLEAN_REPLAY_HISTORICAL_MIGRATIONS)
  problems.push('migraciones históricas incompletas en auditoría de origen');
 if(evidence.historical_data_mutations_excluded!==CLEAN_REPLAY_MUTATIONS_TO_EXCLUDE)
  problems.push('mutaciones de datos históricas no excluidas del esquema limpio');
 if(evidence.reference_catalog_statements_vetted!==CLEAN_REPLAY_REFERENCE_CATALOGS_TO_REVIEW)
  problems.push('catálogos y plantillas sin revisión de origen');
 if(evidence.qa_records_imported!==0 || evidence.qa_users_imported!==0)
  problems.push('datos o usuarios ficticios fueron trasladados a la instalación oficial');
 if(evidence.independent_new_database_verified!==true)
  problems.push('falta validación de una base independiente recién creada');
 if(evidence.schema_only_replay_verified!==true)
  problems.push('falta ensayo de reconstrucción de esquema sin datos históricos');
 return problems;
}
