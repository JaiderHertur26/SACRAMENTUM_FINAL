import { supabase } from '@/lib/supabaseClient';
import {
  LEGACY_IMPORT_PROFILES,
  analyzeLegacyRow,
  detectLegacyProfile,
  extractLegacyRows,
} from '@/config/legacyImportProfiles';

const unwrapRpc = (data) => Array.isArray(data) ? data[0] : data;

const arrayBufferToHex = (buffer) => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2,'0')).join('');

export async function sha256File(file) {
  if (!file) return '';
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return arrayBufferToHex(digest);
}

export async function parseLegacyJsonFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const rows = extractLegacyRows(parsed);
  const profileKey = detectLegacyProfile(file.name, rows);
  return { parsed, rows, profileKey };
}

export function analyzeLegacyRows(profileKey, rows) {
  return rows.map((row,index) => analyzeLegacyRow(profileKey,row,index));
}

export async function listLegacyImportProfiles() {
  const { data, error } = await supabase.from('legacy_import_profiles').select('*').eq('active',true).order('display_name');
  if (error) throw error;
  return data || [];
}

export async function listLegacyBatches({ dioceseId = null, limit = 50 } = {}) {
  let q = supabase.from('legacy_import_batches').select('*').order('created_at',{ascending:false}).limit(limit);
  if (dioceseId) q = q.eq('diocese_id',dioceseId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listLegacyRows(batchId, { status = null, limit = 200 } = {}) {
  let q = supabase.from('legacy_import_rows').select('*').eq('batch_id',batchId).order('row_number').limit(limit);
  if (status) q = q.eq('status',status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createLegacyBatch({ filename, profileKey, hash, sourceName, parishId = null, dioceseId = null, metadata = {} }) {
  const { data, error } = await supabase.rpc('create_legacy_import_batch', {
    p_filename: filename,
    p_profile_key: profileKey,
    p_sha256: hash || null,
    p_source_name: sourceName || null,
    p_parish_id: parishId || null,
    p_diocese_id: dioceseId || null,
    p_metadata: metadata
  });
  if (error) throw error;
  return data;
}

const rowPayload = (row) => ({
  row_number: row.row_number,
  source_key: row.source_key,
  checksum: row.checksum || null,
  target_entity: row.target_entity,
  original_data: row.original_data,
  normalized_data: row.normalized_data,
  status: row.status,
  issue_codes: row.issue_codes || [],
  issue_details: row.issue_details || {}
});

export async function stageLegacyRows(batchId, rows, chunkSize = 200, onProgress = null, sourceScope = '') {
  let staged = 0;
  for (let i=0; i<rows.length; i+=chunkSize) {
    const chunk = rows.slice(i,i+chunkSize).map(row => rowPayload({ ...row, source_key: sourceScope ? `${sourceScope}|${row.source_key}` : row.source_key }));
    const { error } = await supabase.rpc('stage_legacy_import_rows',{ p_batch_id:batchId, p_rows:chunk });
    if (error) throw error;
    staged += chunk.length;
    onProgress?.({staged,total:rows.length});
  }

  // V43: toda fila staged queda además en la bóveda legacy maestra.
  // No depende de que hoy exista un destino funcional para esa tabla antigua.
  const { error: archiveError } = await supabase.rpc('archive_legacy_batch_snapshot_v43', {
    p_batch_id: batchId
  });
  if (archiveError) throw archiveError;

  return staged;
}

export async function reviewLegacyRow({ rowId, normalizedData, status, issueCodes = [], issueDetails = {} }) {
  const { error } = await supabase.rpc('review_legacy_import_row', {
    p_row_id: rowId,
    p_normalized_data: normalizedData,
    p_status: status,
    p_issue_codes: issueCodes,
    p_issue_details: issueDetails
  });
  if (error) throw error;
}

export async function applyLegacyBatch(batchId, { chunkSize = 250, onProgress = null, profileKey = null } = {}) {
  const batch = await getLegacyMigrationSummary(batchId);
  const effectiveProfile = String(profileKey || batch?.profile_key || '').toUpperCase();
  const markMaterialized = async (metadata = {}) => {
    try {
      await markLegacySourceFileMaterialized(batchId, {
        profile_key: effectiveProfile,
        materialized_at: new Date().toISOString(),
        ...metadata,
      });
    } catch (error) {
      // La materialización oficial no debe revertirse sólo porque el manifiesto
      // pertenezca a un lote histórico creado antes de V47.
      console.warn('No fue posible marcar el archivo legacy como materializado', error);
    }
  };
  if (effectiveProfile === 'REPORTES_FRX') {
    const { data, error } = await supabase.rpc('materialize_legacy_report_definitions_v43', { p_batch_id: batchId });
    if (error) throw error;
    const materialized = data || {};
    onProgress?.({ imported: Number(materialized.materialized || 0), failed: 0, remaining: 0 });
    await markMaterialized({ materialized_count:Number(materialized.materialized || 0), target:'legacy_report_definitions' });
    return { imported:Number(materialized.materialized||0), failed:0, remaining:0, materialized, diocesesMaterialized:null, noteReconciliation:null };
  }

  if (effectiveProfile === 'LEGACY_ARCHIVE') {
    const { data, error } = await supabase.rpc('archive_legacy_batch_snapshot_v43', { p_batch_id: batchId });
    if (error) throw error;
    const archived = data || {};
    onProgress?.({ imported: Number(archived.archived || 0), failed: 0, remaining: 0 });
    return { imported:Number(archived.archived||0), failed:0, remaining:0, materialized:archived, diocesesMaterialized:null, noteReconciliation:null };
  }

  if (['NTBAU001','NTBAU002','NTCON001','NTDEF001'].includes(effectiveProfile)) {
    const { data, error } = await supabase.rpc('materialize_legacy_sacramental_notes_v43', {
      p_batch_id: batchId,
      p_limit: Math.min(Math.max(Number(chunkSize || 250), 1), 2000)
    });
    if (error) throw error;
    const materialized = data || {};
    onProgress?.({
      imported: Number(materialized.imported || 0),
      failed: Number(materialized.failed || 0),
      remaining: Number(materialized.pending_review || 0)
    });
    if (Number(materialized.failed || 0) === 0 && Number(materialized.pending_review || 0) === 0) {
      await markMaterialized({
        materialized_count:Number(materialized.imported || 0),
        pending_review:0,
        target:'marginal_notes'
      });
    }
    return {
      imported:Number(materialized.imported||0),
      failed:Number(materialized.failed||0),
      remaining:Number(materialized.pending_review||0),
      materialized,
      diocesesMaterialized:null,
      noteReconciliation:null
    };
  }

  if (effectiveProfile === 'INSMATRI') {
    const { data, error } = await supabase.rpc('materialize_legacy_marriage_dossiers_v43', {
      p_batch_id: batchId
    });
    if (error) throw error;
    const materialized = data || {};
    onProgress?.({
      imported: Number(materialized.materialized || 0),
      failed: 0,
      remaining: 0
    });
    await markMaterialized({
      materialized_count:Number(materialized.materialized || 0),
      target:'marriage_dossiers'
    });
    return {
      imported: Number(materialized.materialized || 0),
      failed: 0,
      remaining: 0,
      materialized,
      diocesesMaterialized: null,
      noteReconciliation: null
    };
  }

  const rpcName = ['NTMAT001','NTMAT002'].includes(effectiveProfile)
    ? 'apply_legacy_marginal_note_batch'
    : 'apply_legacy_import_batch_v2';

  let totalImported = 0;
  let totalFailed = 0;
  let remaining = 1;
  while (remaining > 0) {
    const { data, error } = await supabase.rpc(rpcName,{ p_batch_id:batchId, p_limit:chunkSize });
    if (error) throw error;
    const result = unwrapRpc(data) || {};
    totalImported += Number(result.imported || 0);
    totalFailed += Number(result.failed || 0);
    remaining = Number(result.remaining || 0);
    onProgress?.({ imported: totalImported, failed: totalFailed, remaining });
    if (Number(result.imported || 0) === 0 && remaining > 0) break;
  }

  let noteReconciliation = null;
  if (['NTMAT001','NTMAT002','MATRIMON'].includes(effectiveProfile) && batch?.parish_id) {
    const { data, error } = await supabase.rpc('reconcile_legacy_matrimonial_notes', {
      p_parish_id: batch.parish_id
    });
    if (error) throw error;
    noteReconciliation = data || null;
  }

  const { data: materialized, error: materializeError } = await supabase.rpc(
    'materialize_auxiliary_catalog_batch',
    { p_batch_id: batchId }
  );
  if (materializeError && !String(materializeError.message || '').includes('profile')) {
    throw materializeError;
  }

  const { data: diocesesMaterialized, error: diocesesMaterializeError } = await supabase.rpc(
    'materialize_diocesis_catalog_batch',
    { p_batch_id: batchId }
  );
  if (diocesesMaterializeError && !String(diocesesMaterializeError.message || '').includes('profile')) {
    throw diocesesMaterializeError;
  }

  if (totalFailed === 0 && remaining === 0) {
    await markMaterialized({
      imported:totalImported,
      failed:0,
      remaining:0,
      auxiliary_materialized:Number(materialized?.materialized || 0),
      dioceses_materialized:Number(diocesesMaterialized?.materialized || 0),
    });
  }

  return {
    imported: totalImported,
    failed: totalFailed,
    remaining,
    materialized,
    diocesesMaterialized,
    noteReconciliation
  };
}

export async function materializeLegacyInstallation({
  installationId,
  onProgress = null,
  chunkSize = 250,
} = {}) {
  if (!installationId) throw new Error('Seleccione una instalación SACRAMENTA.');

  const { data: installation, error: installationError } = await supabase
    .from('legacy_source_installations')
    .select('*')
    .eq('id', installationId)
    .single();
  if (installationError) throw installationError;
  if (!installation?.mapped_parish_id) {
    throw new Error('La instalación debe estar vinculada a una parroquia moderna antes de materializarse.');
  }

  const { data: batches, error: batchesError } = await supabase
    .from('legacy_import_batches')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1000);
  if (batchesError) throw batchesError;

  const materializableProfiles = new Set([
    'BAUTIZOS','CONFIRMA','MATRIMON','DIFUNTOS',
    'INSBAUTI','INSCONFI','INSMATRI',
    'PARROCOS','OBISPOS','DIOCESIS','IGLESIAS','CIUDADES',
    'CERTIFICADOS','CPTOANULA','ANULACION',
    'NTBAU001','NTBAU002','NTCON001','NTDEF001','NTMAT001','NTMAT002',
    'REPORTES_FRX'
  ]);

  const priority = (profileKey) => {
    if (['BAUTIZOS','CONFIRMA','MATRIMON','DIFUNTOS'].includes(profileKey)) return 10;
    if (['INSBAUTI','INSCONFI','INSMATRI'].includes(profileKey)) return 20;
    if (['PARROCOS','OBISPOS','DIOCESIS','IGLESIAS','CIUDADES','CERTIFICADOS'].includes(profileKey)) return 30;
    if (profileKey === 'CPTOANULA') return 40;
    if (profileKey === 'ANULACION') return 50;
    if (['NTBAU001','NTBAU002','NTCON001','NTDEF001','NTMAT001','NTMAT002'].includes(profileKey)) return 60;
    if (profileKey === 'REPORTES_FRX') return 70;
    return 100;
  };

  const installationBatches = (batches || [])
    .filter((batch) => (
      batch?.metadata?.source_installation_id === installationId
      || batch?.source_installation_id === installationId
    ))
    .sort((a,b) => {
      const pa=priority(String(a.profile_key || '').toUpperCase());
      const pb=priority(String(b.profile_key || '').toUpperCase());
      if (pa !== pb) return pa - pb;
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });

  const summary = {
    installationId,
    parishId: installation.mapped_parish_id,
    totalBatches: installationBatches.length,
    processedBatches: 0,
    imported: 0,
    failed: 0,
    remaining: 0,
    skipped: 0,
    results: [],
  };

  for (let index = 0; index < installationBatches.length; index += 1) {
    const batch = installationBatches[index];
    const profileKey = String(batch.profile_key || '').toUpperCase();
    const filename = batch.original_filename || batch.source_name || profileKey || 'Lote legacy';

    onProgress?.({
      phase: 'materializing',
      index: index + 1,
      total: installationBatches.length,
      file: filename,
      profileKey,
      imported: summary.imported,
      failed: summary.failed,
    });

    if (!materializableProfiles.has(profileKey)) {
      summary.skipped += 1;
      summary.results.push({
        batchId: batch.id,
        filename,
        profileKey,
        skipped: true,
        reason: 'Perfil preservado únicamente en Archivo Histórico Maestro',
      });
      continue;
    }

    if (!Number(batch.valid_count || 0) && profileKey !== 'REPORTES_FRX') {
      summary.skipped += 1;
      summary.results.push({
        batchId: batch.id,
        filename,
        profileKey,
        skipped: true,
        reason: Number(batch.imported_count || 0) > 0
          ? 'Lote ya materializado o sin filas válidas pendientes'
          : 'Sin filas válidas materializables',
      });
      continue;
    }

    try {
      const result = await applyLegacyBatch(batch.id, {
        chunkSize,
        profileKey,
      });
      summary.processedBatches += 1;
      summary.imported += Number(result.imported || 0);
      summary.failed += Number(result.failed || 0);
      summary.remaining += Number(result.remaining || 0);
      summary.results.push({
        batchId: batch.id,
        filename,
        profileKey,
        ...result,
      });
    } catch (error) {
      summary.failed += 1;
      summary.results.push({
        batchId: batch.id,
        filename,
        profileKey,
        error: error?.message || String(error),
      });
    }
  }

  onProgress?.({ phase: 'materialized', ...summary });
  return summary;
}

export async function loadParishesForMigration(dioceseId = null) {
  let q = supabase.from('parishes').select('id,name,diocese_id,city').order('name');
  if (dioceseId) q = q.eq('diocese_id',dioceseId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function loadMigrationTerritory(dioceseId) {
  if (!dioceseId) return { vicaries: [], deaneries: [] };
  const [vicaryResult, deaneryResult] = await Promise.all([
    supabase.from('vicarias').select('id,name,diocese_id').eq('diocese_id',dioceseId).order('name'),
    supabase.from('decanatos').select('id,name,diocese_id,vicaria_id').eq('diocese_id',dioceseId).order('name'),
  ]);
  if (vicaryResult.error) throw vicaryResult.error;
  if (deaneryResult.error) throw deaneryResult.error;
  return {
    vicaries: vicaryResult.data || [],
    deaneries: deaneryResult.data || [],
  };
}

export async function createParishFromLegacyInstallation({
  installationId,
  vicaryId = null,
  deaneryId = null,
} = {}) {
  if (!installationId) throw new Error('Seleccione una instalación SACRAMENTA.');

  const { data, error } = await supabase.rpc('create_parish_from_legacy_installation_v56', {
    p_source_installation_id: installationId,
    p_vicary_id: vicaryId || null,
    p_deanery_id: deaneryId || null,
  });
  if (error) throw error;
  return data || null;
}

export async function getLegacyMigrationSummary(batchId) {
  const { data: batch, error } = await supabase.from('legacy_import_batches').select('*').eq('id',batchId).single();
  if (error) throw error;
  return batch;
}


export async function listLegacySourceInstallations({ dioceseId = null } = {}) {
  let q = supabase
    .from('legacy_source_installations')
    .select('*')
    .order('legacy_parish_name',{ascending:true})
    .order('created_at',{ascending:true});
  if (dioceseId) q = q.eq('owner_diocese_id',dioceseId);
  const { data,error } = await q;
  if (error) throw error;
  return data || [];
}

export async function registerLegacySourceInstallation({
  identity = {},
  mappedParishId = null,
  sourceName = '',
} = {}) {
  const sourceKey = [
    identity?.serial || 'NO-SERIAL',
    identity?.idcod || 'NO-CODE',
    identity?.nombre || sourceName || 'SIN-NOMBRE'
  ].map(value => String(value || '').trim()).join('|').toLowerCase();

  const { data,error } = await supabase.rpc('upsert_legacy_source_installation_v44',{
    p_source_key:sourceKey,
    p_source_name:sourceName || identity?.nombre || 'Instalación SACRAMENTA',
    p_identity:identity || {},
    p_mapped_parish_id:mappedParishId || null,
  });
  if (error) throw error;
  return data;
}

export async function mapLegacySourceInstallation({
  installationId,
  parishId,
} = {}) {
  const { data,error } = await supabase.rpc('map_legacy_source_installation_v45',{
    p_source_installation_id:installationId,
    p_parish_id:parishId,
  });
  if (error) throw error;
  return data;
}

export async function registerLegacySourceFile({
  installationId,
  batchId = null,
  file,
  hash = '',
  profileKey = '',
  rowCount = 0,
  status = 'preserved',
  metadata = {},
} = {}) {
  if (!installationId || !file) throw new Error('Instalación y archivo son obligatorios.');
  const { data,error } = await supabase.rpc('register_legacy_source_file_v47',{
    p_source_installation_id:installationId,
    p_batch_id:batchId || null,
    p_filename:file.name,
    p_relative_path:file.webkitRelativePath || file.name,
    p_sha256:hash || null,
    p_profile_key:profileKey || null,
    p_row_count:Number(rowCount || 0),
    p_source_size:Number(file.size || 0),
    p_source_last_modified:Number(file.lastModified || 0),
    p_status:status,
    p_metadata:metadata || {},
  });
  if (error) throw error;
  return data;
}

export async function finalizeLegacyBatchPreserved(batchId,{status='preserved'}={}) {
  const {data,error}=await supabase.rpc('finalize_legacy_batch_preserved_v47',{
    p_batch_id:batchId,
    p_file_status:status,
  });
  if(error) throw error;
  return data;
}

export async function markLegacySourceFileMaterialized(batchId,metadata={}) {
  const {data,error}=await supabase.rpc('mark_legacy_source_file_materialized_v47',{
    p_batch_id:batchId,
    p_metadata:metadata,
  });
  if(error) throw error;
  return data;
}

export async function importLegacyInstallationFolder({
  files,
  parishId = null,
  dioceseId = null,
  onProgress = null,
} = {}) {
  const jsonFiles = Array.from(files || [])
    .filter(file => /\.json$/i.test(file.name))
    .sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));

  if (!jsonFiles.length) throw new Error('La carpeta no contiene archivos JSON.');

  const parsed = [];
  for (let index=0; index<jsonFiles.length; index+=1) {
    const file=jsonFiles[index];
    onProgress?.({phase:'reading',file:file.name,index:index+1,total:jsonFiles.length});
    const info=await parseLegacyJsonFile(file);
    parsed.push({file,...info});
  }

  const identityEntry = parsed.find(item => item.profileKey === 'MISDATOS' && item.rows?.length);
  const folderName = String(jsonFiles[0]?.webkitRelativePath || '').split('/')[0]
    || String(jsonFiles[0]?.name || 'Instalación SACRAMENTA');
  const identity = identityEntry?.rows?.[0] || {
    nombre: folderName,
    diocesis: '',
    serial: '',
    idcod: '',
  };

  const installationId = await registerLegacySourceInstallation({
    identity,
    mappedParishId:parishId || null,
    sourceName:identity?.nombre || folderName,
  });

  const summary={
    installationId,
    sourceName:identity?.nombre || folderName,
    files:0,
    primaryFiles:0,
    derivedFiles:0,
    emptyFiles:0,
    rows:0,
    valid:0,
    review:0,
    error:0,
    batches:[],
  };

  for (let index=0; index<parsed.length; index+=1) {
    const item=parsed[index];
    const {file,rows}=item;
    const isDerived=/_transformado(?:\s*\(\d+\))?\.json$/i.test(file.name);
    const hash=await sha256File(file);
    const effectiveProfile=item.profileKey || (rows.length ? 'LEGACY_ARCHIVE' : 'LEGACY_ARCHIVE');

    onProgress?.({
      phase:isDerived?'manifest':'staging',
      file:file.name,
      index:index+1,
      total:parsed.length,
      rows:rows.length,
    });

    summary.files+=1;
    summary.rows+=rows.length;

    if (isDerived) {
      summary.derivedFiles+=1;
      await registerLegacySourceFile({
        installationId,
        file,
        hash,
        profileKey:effectiveProfile,
        rowCount:rows.length,
        status:rows.length?'preserved':'empty',
        metadata:{
          derived_copy:true,
          preservation_note:'Archivo transformado derivado; se conserva en el manifiesto pero no se duplica en la bóveda fila a fila.',
        },
      });
      continue;
    }

    summary.primaryFiles+=1;
    if (!rows.length) summary.emptyFiles+=1;

    const profile=LEGACY_IMPORT_PROFILES[effectiveProfile] || LEGACY_IMPORT_PROFILES.LEGACY_ARCHIVE;
    const analysis=rows.map((row,rowIndex)=>analyzeLegacyRow(effectiveProfile,row,rowIndex));
    const counts=analysis.reduce((acc,row)=>{
      acc[row.status]=(acc[row.status]||0)+1;
      return acc;
    },{});

    const batchId=await createLegacyBatch({
      filename:file.name,
      profileKey:effectiveProfile,
      hash,
      sourceName:`${effectiveProfile}.json`,
      parishId:parishId || null,
      dioceseId:dioceseId || null,
      metadata:{
        source_installation_id:installationId,
        relative_path:file.webkitRelativePath || file.name,
        bulk_installation_import:true,
        preservation_first:true,
        target_entity:profile?.targetEntity || 'legacy_archive',
        source_file_size:file.size || 0,
        source_last_modified:file.lastModified || 0,
      },
    });

    if (analysis.length) {
      await stageLegacyRows(batchId,analysis,200,({staged,total})=>{
        onProgress?.({
          phase:'staging',
          file:file.name,
          index:index+1,
          total:parsed.length,
          staged,
          rows:total,
        });
      },hash);
    } else {
      // Aun las tablas vacías quedan documentadas en el manifiesto.
      await supabase.rpc('archive_legacy_batch_snapshot_v43',{p_batch_id:batchId});
    }

    await registerLegacySourceFile({
      installationId,
      batchId,
      file,
      hash,
      profileKey:effectiveProfile,
      rowCount:rows.length,
      status:rows.length ? 'preserved' : 'empty',
      metadata:{
        target_entity:profile?.targetEntity || 'legacy_archive',
        requires_parish:profile?.requiresParish !== false,
      },
    });

    const closed=await finalizeLegacyBatchPreserved(batchId,{
      status:rows.length ? 'preserved' : 'empty',
    });

    summary.valid+=Number(counts.valid||0);
    summary.review+=Number(counts.review||0);
    summary.error+=Number(counts.error||0);
    summary.batches.push({
      batchId,
      filename:file.name,
      profileKey:effectiveProfile,
      rows:rows.length,
      counts,
      closed,
    });
  }

  onProgress?.({phase:'done',...summary});
  return summary;
}
