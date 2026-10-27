// V223. Strict fail-closed BUILD governance, not a substitute for a privileged DBA review.
// A JSON attestation is useful to prevent accidents, not proof against dishonest admins.
import { KNOWN_QA_PROJECT_REFS, projectRefFromUrl } from '../src/utils/registryDataMode.mjs';

export const assessOfficialBuild = ({ mode, supabaseUrl, report, now = Date.now() } = {}) => {
  const problems = [];
  if (mode !== 'official') return { ok: true, mode: 'test', problems };
  const projectRef = projectRefFromUrl(supabaseUrl);
  if (!projectRef) problems.push('URL HTTPS de Supabase no válida');
  if (KNOWN_QA_PROJECT_REFS.includes(projectRef)) problems.push('proyecto de pruebas: nunca admite modo oficial');
  if (!report || typeof report !== 'object') problems.push('falta acta de inventario certificada');
  else {
    if (report.protocol !== 'V223') problems.push('protocolo de inventario no compatible');
    if (report.environment !== 'CLEAN_PRODUCTION') problems.push('entorno no acreditado como producción limpia');
    if (report.approved_for_official_mode !== true) problems.push('aprobación oficial no documentada');
    if (!projectRef || report.project_ref !== projectRef) problems.push('proyecto certificado distinto de Vercel');
    if (!report.verification_source || !String(report.verification_source).startsWith('privileged-read-only:')) {
      problems.push('origen de auditoría de solo lectura no acreditado');
    }
    const counts = report.counts || {};
    for (const key of ['business_rows','auth_users','storage_objects','unexpected_public_tables','missing_public_tables']) {
      if (!Number.isSafeInteger(counts[key]) || counts[key] !== 0) problems.push('inventario no vacío o sin verificación: ' + key);
    }
    if (counts.tracked_public_tables !== 82 || counts.current_public_tables !== 82) {
      problems.push('cobertura del inventario incompleta: tablas públicas');
    }
    const verifiedAt = Date.parse(report.verified_at);
    if (!Number.isFinite(verifiedAt) || verifiedAt > now || now-verifiedAt > 24*60*60*1000) {
      problems.push('acta de inventario inválida o anterior a 24 horas');
    }
  }
  return {ok:problems.length===0,mode:problems.length?'test':'official',problems};
};
