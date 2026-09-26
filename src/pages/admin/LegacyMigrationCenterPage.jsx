import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import {
  UploadCloud, Database, ShieldCheck, AlertTriangle, CheckCircle2, Loader2,
  FileJson, FileText, History, RefreshCw, Play, Eye, LockKeyhole, GitMerge, Archive, Church
} from 'lucide-react';
import {
  analyzeLegacyRows, applyLegacyBatch, createLegacyBatch, getLegacyMigrationSummary,
  listLegacyBatches, listLegacySourceInstallations, loadParishesForMigration, loadMigrationTerritory,
  importLegacyInstallationFolder, mapLegacySourceInstallation, materializeLegacyInstallation, parseLegacyJsonFile,
  registerLegacySourceInstallation, createParishFromLegacyInstallation, sha256File, stageLegacyRows
} from '@/services/legacyMigrationService';
import { LEGACY_IMPORT_PROFILES, profileOptions } from '@/config/legacyImportProfiles';
import { normalizeRole } from '@/lib/authz';
import { labelMigrationStatus } from '@/utils/uiLabels';


const TARGET_ENTITY_LABELS = Object.freeze({
  baptism: 'Bautismos',
  confirmation: 'Confirmaciones',
  marriage: 'Matrimonios',
  funeral: 'Exequias',
  pending_baptism: 'Inscripciones de Bautismo',
  pending_confirmation: 'Inscripciones de Confirmación',
  pending_marriage: 'Inscripciones de Matrimonio',
  decree_link: 'Vínculos de decretos',
  annulment_concept: 'Conceptos de decreto',
  directory_diocese: 'Directorio de diócesis',
  directory_church: 'Directorio de iglesias',
  location_dictionary: 'Diccionario de lugares',
  legacy_priest_directory: 'Directorio histórico de párrocos',
  legacy_reference_catalog: 'Catálogo histórico auxiliar',
  legacy_marginal_note: 'Notas históricas / marginales',
  legacy_archive: 'Archivo histórico universal',
  legacy_report_definition: 'Catálogo técnico FRX/FRT',
});

const targetEntityLabel = (value) => TARGET_ENTITY_LABELS[value] || value || '—';
const legacyProfileLabel = (key) => LEGACY_IMPORT_PROFILES[key]?.label || key || 'Perfil histórico';

const statCard = (label,value,Icon,tone='slate') => {
  const tones = {
    slate:'bg-slate-50 text-slate-700 border-slate-100',
    blue:'bg-blue-50 text-blue-700 border-blue-100',
    green:'bg-green-50 text-green-700 border-green-100',
    amber:'bg-amber-50 text-amber-700 border-amber-100',
    red:'bg-red-50 text-red-700 border-red-100'
  };
  return <div className={`rounded-2xl border p-4 ${tones[tone]}`}><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em]"><Icon className="w-4 h-4"/>{label}</div><div className="text-2xl font-black mt-2">{value}</div></div>;
};

const LegacyMigrationCenterPage = () => {
  const { user, profile: authProfile } = useAuth();
  const { toast } = useToast();
  const role = normalizeRole(authProfile?.role || user?.role);
  const userDioceseId = authProfile?.diocese_id || user?.dioceseId || user?.diocese_id || null;
  const entityName = role === 'admin_general' ? 'Administrador General' : (user?.dioceseName || 'Diócesis');

  const [file,setFile] = useState(null);
  const [profileKey,setProfileKey] = useState('');
  const [rows,setRows] = useState([]);
  const [analysis,setAnalysis] = useState([]);
  const [hash,setHash] = useState('');
  const [parishes,setParishes] = useState([]);
  const [parishId,setParishId] = useState('');
  const [installations,setInstallations] = useState([]);
  const [sourceInstallationId,setSourceInstallationId] = useState('');
  const [mappingParishId,setMappingParishId] = useState('');
  const [territory,setTerritory] = useState({vicaries:[],deaneries:[]});
  const [legacyVicaryId,setLegacyVicaryId] = useState('');
  const [legacyDeaneryId,setLegacyDeaneryId] = useState('');
  const [legacyCreateConfirmed,setLegacyCreateConfirmed] = useState(false);
  const [batches,setBatches] = useState([]);
  const [currentBatch,setCurrentBatch] = useState(null);
  const [busy,setBusy] = useState('');
  const [progress,setProgress] = useState(null);
  const [bulkSummary,setBulkSummary] = useState(null);
  const [installationMaterialization,setInstallationMaterialization] = useState(null);
  const [error,setError] = useState('');

  const importProfile = profileKey ? LEGACY_IMPORT_PROFILES[profileKey] : null;
  const isHistoricalBallot = ['INSBAUTI','INSCONFI'].includes(profileKey);
  const allowParishSelection = importProfile?.requiresParish !== false;
  const selectedInstallation = useMemo(
    () => installations.find(item => item.id===sourceInstallationId) || null,
    [installations,sourceInstallationId]
  );
  const legacyDeaneries = useMemo(
    () => (territory.deaneries || []).filter(item => !legacyVicaryId || item.vicaria_id===legacyVicaryId),
    [territory.deaneries,legacyVicaryId]
  );
  const archiveOnlyUntilMapped = Boolean(
    importProfile?.requiresParish
    && selectedInstallation
    && !selectedInstallation.mapped_parish_id
    && !parishId
  );
  const counts = useMemo(() => analysis.reduce((acc,r)=>{ acc[r.status]=(acc[r.status]||0)+1; return acc; },{}),[analysis]);
  const noteCounts = useMemo(() => analysis.reduce((acc,r)=>{
    if (String(profileKey).startsWith('NTMAT')) {
      const key = r.normalized_data?.classification || 'sin_clasificar';
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  },{}),[analysis,profileKey]);
  const boletaCounts = useMemo(() => analysis.reduce((acc,r)=>{
    if (['INSBAUTI','INSCONFI'].includes(profileKey)) {
      if (r.normalized_data?.reported === true) acc.reported += 1; else acc.notSeated += 1;
    }
    return acc;
  },{reported:0,notSeated:0}),[analysis,profileKey]);
  const issuesTop = useMemo(() => {
    const map = new Map();
    analysis.flatMap(r => r.issue_details?.issues || []).forEach(i=>map.set(i.code,(map.get(i.code)||0)+1));
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
  },[analysis]);

  const refreshBatches = async () => {
    try { setBatches(await listLegacyBatches({dioceseId: role==='admin_general' ? null : userDioceseId, limit:30})); }
    catch(e){ console.error(e); }
  };

  const refreshInstallations = async () => {
    const rows = await listLegacySourceInstallations({dioceseId: role==='admin_general' ? null : userDioceseId});
    setInstallations(rows || []);
    return rows || [];
  };

  useEffect(()=>{
    Promise.all([
      loadParishesForMigration(role==='admin_general' ? null : userDioceseId),
      refreshBatches(),
      refreshInstallations()
    ])
      .then(([p])=>setParishes(p || []))
      .catch(e=>setError(e.message));
  },[role,userDioceseId]);

  useEffect(()=>{
    if (role!=='diocese' || !userDioceseId) {
      setTerritory({vicaries:[],deaneries:[]});
      return;
    }
    loadMigrationTerritory(userDioceseId)
      .then(setTerritory)
      .catch(e=>setError(e.message));
  },[role,userDioceseId]);

  useEffect(()=>{
    if (selectedInstallation?.mapped_parish_id) {
      setParishId(selectedInstallation.mapped_parish_id);
    }
    setLegacyVicaryId('');
    setLegacyDeaneryId('');
    setLegacyCreateConfirmed(false);
  },[sourceInstallationId,selectedInstallation?.mapped_parish_id]);

  useEffect(()=>{
    if (legacyDeaneryId && !legacyDeaneries.some(item=>item.id===legacyDeaneryId)) {
      setLegacyDeaneryId('');
    }
  },[legacyVicaryId,legacyDeaneryId,legacyDeaneries]);

  const importFullInstallation = async (pickedFiles) => {
    const files=Array.from(pickedFiles || []);
    if (!files.length) return;
    setBusy('bulk'); setError(''); setBulkSummary(null);
    setProgress({message:'Leyendo instalación completa…'});
    try {
      const summary=await importLegacyInstallationFolder({
        files,
        parishId:parishId || null,
        dioceseId:role==='admin_general' ? null : userDioceseId,
        onProgress:(p)=>{
          if(p.phase==='reading') setProgress({message:`Leyendo ${p.file} · ${p.index}/${p.total}`});
          else if(p.phase==='manifest') setProgress({message:`Registrando derivado ${p.file} · ${p.index}/${p.total}`});
          else if(p.phase==='staging') setProgress({message:`Preservando ${p.file} · ${p.staged ?? 0}/${p.rows ?? 0} filas`});
          else if(p.phase==='done') setProgress({message:'Instalación preservada completamente.'});
        }
      });
      setBulkSummary(summary);
      setSourceInstallationId(summary.installationId || '');
      await Promise.all([refreshInstallations(),refreshBatches()]);
      toast({
        title:'Instalación legacy preservada',
        description:`${summary.primaryFiles} archivos fuente · ${summary.rows} filas leídas · ${summary.review} en revisión. Nada fue descartado.`,
        className:'bg-green-50 text-green-900 border-green-200'
      });
    } catch(e) {
      setError(e.message);
    } finally {
      setBusy(''); setProgress(null);
    }
  };

  const onFile = async (picked) => {
    if (!picked) return;
    setBusy('reading'); setError(''); setCurrentBatch(null); setProgress(null);
    try {
      const [{rows: rawRows,profileKey: detected}, digest] = await Promise.all([parseLegacyJsonFile(picked),sha256File(picked)]);
      const chosen = detected || profileKey;
      if (!chosen) throw new Error('No pude reconocer automáticamente la estructura. Selecciona el perfil manualmente.');
      setFile(picked); setRows(rawRows); setHash(digest); setProfileKey(chosen);
      const analyzed = analyzeLegacyRows(chosen,rawRows);
      setAnalysis(analyzed);
      const p = LEGACY_IMPORT_PROFILES[chosen];
      toast({title:'Archivo analizado',description:`${rawRows.length} filas · perfil ${p?.label || chosen}`});
    } catch(e){ setError(e.message); setAnalysis([]); }
    finally { setBusy(''); }
  };

  const reanalyze = () => {
    if (!profileKey || !rows.length) return;
    try { setAnalysis(analyzeLegacyRows(profileKey,rows)); setCurrentBatch(null); setError(''); }
    catch(e){ setError(e.message); }
  };

  const stage = async () => {
    if (!file || !profileKey || !analysis.length) return;
    if (importProfile?.requiresParish !== false && !parishId && !sourceInstallationId && profileKey!=='MISDATOS') {
      setError('Selecciona la parroquia propietaria o la instalación SACRAMENTA de origen.');
      return;
    }
    setBusy('staging'); setError(''); setProgress({message:'Creando lote seguro...'});
    try {
      let activeInstallationId = sourceInstallationId;

      if (profileKey==='MISDATOS' && !activeInstallationId) {
        const identity = rows[0] || {};
        activeInstallationId = await registerLegacySourceInstallation({
          identity,
          mappedParishId: parishId || null,
          sourceName: identity?.nombre || file.name
        });
        setSourceInstallationId(activeInstallationId);
        await refreshInstallations();
      }

      const chosenParish = parishes.find(p=>p.id===parishId);
      const batchId = await createLegacyBatch({
        filename:file.name, profileKey, hash, sourceName:`${profileKey}.json`,
        parishId: parishId || null,
        dioceseId: chosenParish?.diocese_id || selectedInstallation?.owner_diocese_id || userDioceseId || null,
        metadata:{
          file_size:file.size,
          analyzed_client_side:true,
          structure_version:'legacy-master-v45',
          source_scope:hash,
          source_installation_id:activeInstallationId || null,
          reconciliation_mode:['INSBAUTI','INSCONFI'].includes(profileKey) ? 'historical_boleta_crossmatch' : 'standard',
          boleta_counts:['INSBAUTI','INSCONFI'].includes(profileKey) ? { reported:boletaCounts.reported, not_seated:boletaCounts.notSeated } : undefined
        }
      });
      await stageLegacyRows(batchId,analysis,200,({staged,total})=>setProgress({message:`Guardando staging ${staged}/${total}` }),hash);
      const batch = await getLegacyMigrationSummary(batchId);
      setCurrentBatch(batch);
      await refreshBatches();
      toast({title:'Staging completado',description:'El JSON original y su normalización quedaron guardados sin tocar los libros oficiales.',className:'bg-green-50 text-green-900 border-green-200'});
    } catch(e){ setError(e.message); }
    finally { setBusy(''); setProgress(null); }
  };

  const mapSelectedInstallation = async () => {
    if (!sourceInstallationId || !mappingParishId) return;
    setBusy('mapping'); setError('');
    try {
      await mapLegacySourceInstallation({
        installationId:sourceInstallationId,
        parishId:mappingParishId
      });
      const refreshed = await refreshInstallations();
      const mapped = refreshed.find(item=>item.id===sourceInstallationId);
      setParishId(mapped?.mapped_parish_id || mappingParishId);
      setMappingParishId('');
      if (currentBatch?.id) setCurrentBatch(await getLegacyMigrationSummary(currentBatch.id));
      await refreshBatches();
      toast({
        title:'Instalación legacy vinculada',
        description:'Los lotes archivados de esta instalación ya tienen parroquia propietaria verificada.',
        className:'bg-green-50 text-green-900 border-green-200'
      });
    } catch(e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const createParishFromSelectedInstallation = async () => {
    if (
      role!=='diocese'
      || !sourceInstallationId
      || !selectedInstallation
      || selectedInstallation.mapped_parish_id
      || !legacyCreateConfirmed
    ) return;

    setBusy('creating-legacy-parish');
    setError('');
    try {
      const result = await createParishFromLegacyInstallation({
        installationId: sourceInstallationId,
        vicaryId: legacyVicaryId || null,
        deaneryId: legacyDeaneryId || null,
      });

      const [freshParishes, refreshedInstallations] = await Promise.all([
        loadParishesForMigration(userDioceseId),
        refreshInstallations(),
      ]);
      setParishes(freshParishes || []);
      setParishId(result?.parish_id || '');
      setMappingParishId('');
      setLegacyCreateConfirmed(false);

      const mapped = refreshedInstallations.find(item=>item.id===sourceInstallationId);
      if (mapped?.mapped_parish_id) setParishId(mapped.mapped_parish_id);

      if (currentBatch?.id) {
        setCurrentBatch(await getLegacyMigrationSummary(currentBatch.id));
      }
      await refreshBatches();

      toast({
        title:'Parroquia creada desde identidad legacy',
        description: `${result?.name || 'La parroquia'} quedó creada, territorializada y vinculada a toda la instalación SACRAMENTA.`,
        className:'bg-green-50 text-green-900 border-green-200'
      });
    } catch(e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const materializeSelectedInstallation = async () => {
    if (!sourceInstallationId) return;
    if (!selectedInstallation?.mapped_parish_id) {
      setError('Primero vincule esta instalación SACRAMENTA con la parroquia moderna correcta.');
      return;
    }

    setBusy('materializing-installation');
    setError('');
    setInstallationMaterialization(null);
    setProgress({message:'Preparando materialización integral de la instalación…'});

    try {
      const result = await materializeLegacyInstallation({
        installationId: sourceInstallationId,
        chunkSize: 250,
        onProgress: (p) => {
          if (p.phase === 'materializing') {
            setProgress({
              message: `Materializando ${p.file || p.profileKey || 'lote'} · ${p.index}/${p.total} · incorporados ${p.imported || 0}`
            });
          } else if (p.phase === 'materialized') {
            setProgress({message:'Materialización integral completada.'});
          }
        }
      });

      setInstallationMaterialization(result);
      await Promise.all([refreshInstallations(), refreshBatches()]);
      toast({
        title:'Instalación materializada',
        description:`${result.processedBatches} lotes procesados · ${result.imported} filas incorporadas · ${result.skipped} lotes conservados sin materializar · ${result.failed} incidencias.`,
        className: result.failed ? undefined : 'bg-green-50 text-green-900 border-green-200',
        ...(result.failed ? { variant:'destructive' } : {})
      });
    } catch(e) {
      setError(e.message);
    } finally {
      setBusy('');
      setProgress(null);
    }
  };

  const applyValid = async () => {
    if (!currentBatch?.id) return;
    if (importProfile?.requiresParish && !currentBatch.parish_id) {
      setError('Este lote está preservado, pero no puede materializarse hasta vincular su instalación legacy con una parroquia moderna.');
      return;
    }
    setBusy('applying'); setError('');
    try {
      const result = await applyLegacyBatch(currentBatch.id,{
        chunkSize:200,
        profileKey:currentBatch.profile_key || profileKey,
        onProgress:(p)=>setProgress({message:`Importados ${p.imported} · errores ${p.failed} · pendientes válidos ${p.remaining}`})
      });
      const fresh = await getLegacyMigrationSummary(currentBatch.id); setCurrentBatch(fresh); await refreshBatches();
      const activeProfile = String(currentBatch.profile_key || profileKey || '').toUpperCase();
      const auxiliaryProfiles = ['PARROCOS','IGLESIAS','CIUDADES','OBISPOS'];
      const isAuxiliaryCatalog = auxiliaryProfiles.includes(activeProfile);
      const materializedCount = Number(result.materialized?.materialized || 0);
      const noteInfo = result.noteReconciliation
        ? ` · notas enlazadas ${result.noteReconciliation.total_matched ?? result.noteReconciliation.matched ?? 0} · pendientes ${result.noteReconciliation.total_pending ?? result.noteReconciliation.pending ?? 0} · ambiguas ${result.noteReconciliation.total_ambiguous ?? result.noteReconciliation.ambiguous ?? 0}`
        : '';

      if (isAuxiliaryCatalog && materializedCount !== Number(result.imported || 0)) {
        toast({
          title:'Importación aplicada con materialización incompleta',
          description:`${result.imported} filas procesadas · ${materializedCount} publicadas en Datos Auxiliares. Revisa el lote antes de continuar.`,
          variant:'destructive'
        });
      } else if (isAuxiliaryCatalog) {
        toast({
          title:'Importación y publicación completadas',
          description:`${result.imported} filas importadas · ${materializedCount} visibles en Datos Auxiliares.`,
          className:'bg-green-50 text-green-900 border-green-200'
        });
      } else {
        toast({title:'Importación aplicada',description:`${result.imported} filas incorporadas${noteInfo}. Las filas dudosas permanecen en revisión.`,className:'bg-blue-50 text-blue-900 border-blue-200'});
      }
    } catch(e){ setError(e.message); }
    finally { setBusy(''); setProgress(null); }
  };

  return <DashboardLayout entityName={entityName}>
    <div className="max-w-7xl mx-auto pb-24 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.25em] mb-3"><Archive className="w-3.5 h-3.5"/> Migración histórica controlada</div>
          <h1 className="text-4xl font-black tracking-tight text-slate-950">Centro de Migración</h1>
          <p className="text-slate-500 mt-2 max-w-3xl">Analiza bases SACRAMENTA/legacy, conserva cada fila original, detecta anomalías y sólo promueve al registro oficial lo que ha pasado validación.</p>
        </div>
        <Button variant="outline" onClick={refreshBatches} className="rounded-xl gap-2"><RefreshCw className="w-4 h-4"/> Actualizar historial</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-gradient-to-br from-slate-950 to-slate-800 rounded-[2rem] p-6 text-white shadow-xl">
          <div className="flex items-start gap-4"><div className="p-3 bg-white/10 rounded-2xl"><ShieldCheck className="w-6 h-6"/></div><div><h2 className="font-black text-lg !text-white">Nunca importación directa</h2><p className="text-slate-300 text-sm mt-1">Archivo → análisis → staging → revisión → importación idempotente → auditoría. Una fila dudosa no modifica una partida oficial.</p></div></div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-[2rem] p-6"><div className="flex gap-3"><LockKeyhole className="w-5 h-5 text-amber-700 shrink-0"/><div><h3 className="font-black text-amber-950">Ámbito seguro</h3><p className="text-xs text-amber-800 mt-1">Solo Administrador General o Diócesis pueden ejecutar migraciones. Cancillería puede auditar posteriormente.</p></div></div></div>
      </div>

      <div className="rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-900 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white">
              <Archive className="h-3.5 w-3.5"/> Instalación completa
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">Preservar toda una base SACRAMENTA</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Seleccione la carpeta JSON convertida. SACRAMENTUM detecta MISDATOS, crea la identidad de la instalación antigua,
              registra cada archivo, conserva cada fila original y deja las tablas sin equivalente moderno en el Archivo Histórico Maestro.
              Los archivos <b>*_transformado.json</b> se registran como derivados, sin duplicar sus filas.
            </p>
            <p className="mt-2 text-xs font-bold text-emerald-800">
              Si no se ha verificado una parroquia moderna equivalente, deje la parroquia vacía: la instalación queda preservada sin mezclar datos.
            </p>
          </div>
          <label className={`inline-flex min-w-64 cursor-pointer items-center justify-center rounded-2xl px-6 py-4 font-black transition ${busy==='bulk'?'bg-slate-200 text-slate-500':'bg-emerald-800 text-white hover:bg-emerald-900'}`}>
            {busy==='bulk'?<Loader2 className="mr-2 h-5 w-5 animate-spin"/>:<UploadCloud className="mr-2 h-5 w-5"/>}
            {busy==='bulk'?'Preservando instalación…':'Seleccionar carpeta completa'}
            <input
              type="file"
              accept="application/json,.json"
              multiple
              webkitdirectory=""
              directory=""
              disabled={!!busy}
              className="hidden"
              onChange={e=>importFullInstallation(e.target.files)}
            />
          </label>
        </div>

        {bulkSummary&&<div className="mt-5 grid grid-cols-2 gap-3 border-t border-emerald-100 pt-5 md:grid-cols-6">
          {statCard('Archivos',bulkSummary.files,FileJson,'green')}
          {statCard('Fuentes',bulkSummary.primaryFiles,Database,'blue')}
          {statCard('Derivados',bulkSummary.derivedFiles,FileText,'slate')}
          {statCard('Filas leídas',bulkSummary.rows,Database,'green')}
          {statCard('Revisión',bulkSummary.review,AlertTriangle,'amber')}
          {statCard('Errores',bulkSummary.error,AlertTriangle,bulkSummary.error?'red':'slate')}
        </div>}
        {bulkSummary&&<div className="mt-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 text-xs text-emerald-900">
          <b>{bulkSummary.sourceName}</b> · instalación {String(bulkSummary.installationId||'').slice(0,8)}… · {bulkSummary.emptyFiles} tablas vacías documentadas · {bulkSummary.batches.length} lotes primarios preservados.
        </div>}
      </div>

      <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3"><div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl"><UploadCloud className="w-5 h-5"/></div><div><h2 className="font-black">1. Cargar y analizar estructura</h2><p className="text-xs text-slate-500">El análisis ocurre antes de tocar Supabase.</p></div></div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <label className="lg:col-span-1 border-2 border-dashed border-slate-200 rounded-2xl p-7 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors min-h-48">
            {busy==='reading'?<Loader2 className="w-8 h-8 animate-spin text-blue-600"/>:<FileJson className="w-10 h-10 text-blue-600"/>}
            <span className="font-black mt-3">Seleccionar JSON</span><span className="text-xs text-slate-400 mt-1">Sacramentos, NTMAT001/NTMAT002, preinscripciones, PARROCOS, CIUDADES, DIOCESIS, IGLESIAS y catálogos legacy.</span>
            <input type="file" accept="application/json,.json" className="hidden" onChange={e=>onFile(e.target.files?.[0])}/>
          </label>
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
            <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Perfil detectado</label><select className="w-full mt-2 border rounded-xl px-4 py-3 font-bold bg-white" value={profileKey} onChange={e=>setProfileKey(e.target.value)}>{!profileKey&&<option value="">Seleccione…</option>}{profileOptions.map(p=><option key={p.key} value={p.key}>{p.key} · {p.label}</option>)}</select></div>
            <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{allowParishSelection ? 'Parroquia moderna · si está verificada' : 'Parroquia moderna · no aplica'}</label><select disabled={!allowParishSelection || Boolean(selectedInstallation?.mapped_parish_id)} className="w-full mt-2 border rounded-xl px-4 py-3 font-bold bg-white disabled:bg-slate-50 disabled:text-slate-400" value={parishId} onChange={e=>setParishId(e.target.value)}><option value="">Aún no vincular a una parroquia…</option>{parishes.map(p=><option key={p.id} value={p.id}>{p.name}{p.city?` · ${p.city}`:''}</option>)}</select></div>
            <div className="md:col-span-2"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Instalación SACRAMENTA de origen</label><select className="w-full mt-2 border rounded-xl px-4 py-3 font-bold bg-white" value={sourceInstallationId} onChange={e=>{setSourceInstallationId(e.target.value);setParishId('');}}><option value="">{profileKey==='MISDATOS'?'Se creará desde MISDATOS al guardar…':'Seleccione la instalación antigua…'}</option>{installations.map(item=><option key={item.id} value={item.id}>{item.legacy_parish_name||item.source_name} · {item.mapping_status==='mapped'?'VINCULADA':'SIN VINCULAR'}</option>)}</select>{selectedInstallation&&<div className={`mt-2 rounded-xl border px-3 py-2 text-xs ${selectedInstallation.mapped_parish_id?'border-green-100 bg-green-50 text-green-800':'border-amber-100 bg-amber-50 text-amber-800'}`}><b>{selectedInstallation.legacy_parish_name||selectedInstallation.source_name}</b> · {selectedInstallation.legacy_diocese_name||'Diócesis no informada'} · {selectedInstallation.mapping_status==='mapped'?'Parroquia moderna verificada':'Preservación solamente; no materializar todavía'}</div>}</div>
            {selectedInstallation&&!selectedInstallation.mapped_parish_id&&<div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-end"><label className="flex-1"><span className="text-[9px] font-black uppercase tracking-wider text-amber-800">Vincular instalación cuando esté verificada</span><select value={mappingParishId} onChange={e=>setMappingParishId(e.target.value)} className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 font-bold"><option value="">Seleccione parroquia moderna…</option>{parishes.map(p=><option key={p.id} value={p.id}>{p.name}{p.city?` · ${p.city}`:''}</option>)}</select></label><Button type="button" variant="outline" disabled={!mappingParishId||busy==='mapping'} onClick={mapSelectedInstallation}>{busy==='mapping'?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<GitMerge className="mr-2 h-4 w-4"/>}Vincular instalación</Button></div><p className="mt-2 text-[10px] text-amber-800">No vincule por parecido de nombre. Debe corresponder exactamente a la misma parroquia histórica.</p></div>}

            {selectedInstallation&&!selectedInstallation.mapped_parish_id&&role==='diocese'&&<div className="md:col-span-2 rounded-[1.5rem] border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[#4B7BA7] p-2.5 text-white"><Church className="h-5 w-5"/></div>
                <div className="flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#4B7BA7]">Identidad legacy verificada · crear parroquia moderna</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">{selectedInstallation.legacy_parish_name||selectedInstallation.source_name}</h3>
                  <div className="mt-2 grid gap-1 text-xs text-slate-600 md:grid-cols-2">
                    <p><b>Ciudad:</b> {selectedInstallation.legacy_city||selectedInstallation.metadata?.ciudad||'—'}</p>
                    <p><b>NIT:</b> {selectedInstallation.metadata?.nronit||'—'}</p>
                    <p><b>Dirección:</b> {selectedInstallation.metadata?.direccion||'—'}</p>
                    <p><b>Teléfono:</b> {selectedInstallation.metadata?.telefono||'—'}</p>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
                    Use esta opción sólo cuando la parroquia histórica no exista todavía en SACRAMENTUM. Se copiarán únicamente los datos institucionales que constan en MISDATOS; la Diócesis debe seleccionar expresamente la Vicaría y el Decanato correctos.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Vicaría · requerida</span>
                  <select
                    value={legacyVicaryId}
                    onChange={e=>setLegacyVicaryId(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-3 py-2.5 font-bold"
                  >
                    <option value="">Seleccione Vicaría…</option>
                    {(territory.vicaries||[]).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Decanato · requerido</span>
                  <select
                    value={legacyDeaneryId}
                    onChange={e=>setLegacyDeaneryId(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-3 py-2.5 font-bold"
                  >
                    <option value="">Seleccione Decanato…</option>
                    {legacyDeaneries.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              </div>

              <label className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-white px-4 py-3 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={legacyCreateConfirmed}
                  onChange={e=>setLegacyCreateConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  Confirmo que esta identidad corresponde a una parroquia real de mi jurisdicción y que no existe ya con otro nombre en SACRAMENTUM.
                </span>
              </label>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] font-bold text-blue-800">
                  Después de crearla, toda la instalación quedará vinculada y podrá materializarse por lotes auditables.
                </p>
                <Button
                  type="button"
                  disabled={!legacyCreateConfirmed||!legacyVicaryId||!legacyDeaneryId||!!busy}
                  onClick={createParishFromSelectedInstallation}
                  className="shrink-0 bg-[#4B7BA7] text-white hover:bg-[#3F6C95]"
                >
                  {busy==='creating-legacy-parish'?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Church className="mr-2 h-4 w-4"/>}
                  Crear parroquia y vincular
                </Button>
              </div>
            </div>}

            {selectedInstallation?.mapped_parish_id&&<div className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">Instalación verificada · lista para aprovechamiento integral</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-900">SACRAMENTUM conservará intacta la fuente y materializará en los módulos modernos únicamente los perfiles que ya tienen reglas seguras de conversión. Lo desconocido seguirá disponible en el Archivo Histórico Maestro.</p>
                </div>
                <Button
                  type="button"
                  disabled={!!busy}
                  onClick={materializeSelectedInstallation}
                  className="shrink-0 bg-emerald-800 text-white hover:bg-emerald-900"
                >
                  {busy==='materializing-installation'?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Play className="mr-2 h-4 w-4"/>}
                  Materializar instalación completa
                </Button>
              </div>
              {installationMaterialization&&<div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
                {statCard('Lotes',installationMaterialization.totalBatches,Database,'slate')}
                {statCard('Procesados',installationMaterialization.processedBatches,CheckCircle2,'green')}
                {statCard('Filas incorporadas',installationMaterialization.imported,Database,'blue')}
                {statCard('Conservados',installationMaterialization.skipped,Archive,'amber')}
                {statCard('Incidencias',installationMaterialization.failed,AlertTriangle,installationMaterialization.failed?'red':'slate')}
              </div>}
            </div>}

            <div className="md:col-span-2 flex flex-wrap gap-2"><Button variant="outline" disabled={!rows.length||!profileKey} onClick={reanalyze} className="rounded-xl gap-2"><GitMerge className="w-4 h-4"/> Reanalizar con este perfil</Button>{file&&<div className="px-4 py-2 rounded-xl bg-slate-50 text-xs text-slate-600"><b>{file.name}</b> · {rows.length} filas · SHA-256 {hash.slice(0,12)}…</div>}</div>
          </div>
        </div>
      </div>

      {file && rows.length===0 && <div className="bg-slate-50 border rounded-2xl p-5 text-slate-600"><b>{file.name}</b> fue reconocido como <b>{legacyProfileLabel(profileKey)}</b>, pero contiene 0 filas; no hay datos que importar.</div>}

      {analysis.length>0&&<>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {statCard('Total',analysis.length,Database,'slate')}{statCard('Válidos',counts.valid||0,CheckCircle2,'green')}{statCard('Revisión',counts.review||0,AlertTriangle,'amber')}{statCard('Perfil',legacyProfileLabel(profileKey),FileJson,'blue')}{statCard('Destino',targetEntityLabel(importProfile?.targetEntity),GitMerge,'slate')}
        </div>
        {['INSBAUTI','INSCONFI'].includes(profileKey)&&<div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><div className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-700">Boletas reportadas · deberían tener partida</div><div className="text-2xl font-black text-blue-950 mt-1">{boletaCounts.reported}</div></div><div className="rounded-2xl border border-violet-100 bg-violet-50 p-4"><div className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-700">Boletas no sentadas · se conservan</div><div className="text-2xl font-black text-violet-950 mt-1">{boletaCounts.notSeated}</div></div></div>}
        {String(profileKey).startsWith('NTMAT')&&<div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5"><div className="flex items-start gap-3"><FileText className="w-5 h-5 text-indigo-700 shrink-0"/><div><h3 className="font-black text-indigo-950">Notas históricas de Matrimonio</h3><p className="text-xs text-indigo-800 mt-1">Se conserva el texto literal. El vínculo usa exclusivamente Libro + Folio + Número. Si todavía no existe la partida, la nota queda en espera y se conciliará de nuevo cuando se importe MATRIMON. El campo actualizad se conserva como metadato de la base antigua y no se presenta como fecha jurídica de la nota.</p><div className="flex flex-wrap gap-2 mt-3">{Object.entries(noteCounts).map(([key,count])=><span key={key} className="px-2.5 py-1 rounded-full bg-white border border-indigo-200 text-[9px] font-black uppercase text-indigo-700">{key.replaceAll('_',' ')} · {count}</span>)}</div></div></div></div>}
        {issuesTop.length>0&&<div className="bg-amber-50 border border-amber-100 rounded-2xl p-5"><h3 className="font-black text-amber-950 flex gap-2 items-center"><AlertTriangle className="w-4 h-4"/> Hallazgos principales</h3><div className="flex flex-wrap gap-2 mt-3">{issuesTop.map(([code,count])=><span key={code} className="px-3 py-1.5 rounded-full bg-white border border-amber-200 text-[10px] font-black text-amber-800">{code} · {count}</span>)}</div></div>}
        <div className="bg-white border rounded-[2rem] overflow-hidden"><div className="p-5 border-b flex justify-between items-center"><div><h3 className="font-black">Vista previa de normalización</h3><p className="text-xs text-slate-500">Primeras 20 filas. El JSON original siempre queda conservado.</p></div><Eye className="w-5 h-5 text-slate-400"/></div><div className="overflow-auto max-h-[520px]"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-50"><tr><th className="p-3 text-left">#</th><th className="p-3 text-left">Clave legacy</th><th className="p-3 text-left">Estado</th><th className="p-3 text-left min-w-72">Problemas</th><th className="p-3 text-left min-w-[420px]">Normalizado</th></tr></thead><tbody>{analysis.slice(0,20).map(r=><tr key={r.row_number} className="border-t align-top"><td className="p-3 font-mono">{r.row_number}</td><td className="p-3 font-mono">{r.source_key}</td><td className="p-3"><span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${r.status==='valid'?'bg-green-50 text-green-700':'bg-amber-50 text-amber-700'}`}>{labelMigrationStatus(r.status)}</span></td><td className="p-3">{(r.issue_details?.issues||[]).map((i,idx)=><div key={idx} className="mb-1"><b>{i.code}</b>: {i.detail}</div>)}</td><td className="p-3 font-mono whitespace-pre-wrap break-all text-[10px] text-slate-500">{JSON.stringify(r.normalized_data,null,2)}</td></tr>)}</tbody></table></div></div>
        <div className="bg-white border rounded-[2rem] p-6 flex flex-col lg:flex-row justify-between gap-4 items-start lg:items-center"><div><h3 className="font-black">2. Guardar staging seguro</h3><p className="text-sm text-slate-500 mt-1">Esto todavía NO crea partidas. Guarda archivo, hash, fila original, transformación e incidencias.</p></div><Button onClick={stage} disabled={!!busy||!analysis.length} className="rounded-xl px-6 gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold border border-slate-900 [&_svg]:text-white disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-200 disabled:[&_svg]:text-slate-500">{busy==='staging'?<Loader2 className="w-4 h-4 animate-spin"/>:<Database className="w-4 h-4"/>} Crear staging</Button></div>
      </>}

      {currentBatch&&<div className="bg-white border border-blue-100 rounded-[2rem] p-6 shadow-sm"><div className="flex flex-col lg:flex-row justify-between gap-5"><div><span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">Lote {currentBatch.id.slice(0,8)}</span><h3 className="text-xl font-black mt-1">Staging listo</h3><p className="text-sm text-slate-500 mt-1">{currentBatch.valid_count} válidos · {currentBatch.review_count} en revisión · {currentBatch.error_count} errores</p>{currentBatch.metadata?.reconciliation&&<div className="flex flex-wrap gap-2 mt-3 text-[9px] font-black uppercase"><span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700">Conciliados {currentBatch.metadata.reconciliation.matched||0}</span><span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">Reportadas sin partida {currentBatch.metadata.reconciliation.unmatched||0}</span><span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Ambiguos {currentBatch.metadata.reconciliation.ambiguous||0}</span><span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700">Revisión {currentBatch.metadata.reconciliation.review||0}</span></div>}
          {currentBatch.metadata?.note_reconciliation&&<div className="flex flex-wrap gap-2 mt-3 text-[9px] font-black uppercase"><span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700">Notas enlazadas {currentBatch.metadata.note_reconciliation.total_matched ?? currentBatch.metadata.note_reconciliation.matched ?? 0}</span><span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">En espera de partida {currentBatch.metadata.note_reconciliation.total_pending ?? currentBatch.metadata.note_reconciliation.pending ?? 0}</span><span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Referencias ambiguas {currentBatch.metadata.note_reconciliation.total_ambiguous ?? currentBatch.metadata.note_reconciliation.ambiguous ?? 0}</span></div>}</div><Button disabled={!!busy||!currentBatch.valid_count||(importProfile?.requiresParish&&!currentBatch.parish_id)} onClick={applyValid} className="rounded-xl px-6 gap-2 bg-green-700 hover:bg-green-800 text-white font-bold border border-green-700 [&_svg]:text-white disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-200 disabled:[&_svg]:text-slate-500">{busy==='applying'?<Loader2 className="w-4 h-4 animate-spin"/>:<Play className="w-4 h-4"/>} {importProfile?.requiresParish&&!currentBatch.parish_id?'Preservado · falta vincular parroquia':(['INSBAUTI','INSCONFI'].includes(profileKey)?'Importar todas las boletas':'Importar únicamente válidos')}</Button></div>{progress&&<div className="mt-4 p-3 rounded-xl bg-blue-50 text-blue-800 text-xs font-bold">{progress.message}</div>}</div>}

      {error&&<div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-800"><div className="flex gap-3"><AlertTriangle className="w-5 h-5 shrink-0"/><div><h3 className="font-black">Operación detenida</h3><p className="text-sm mt-1">{error}</p></div></div></div>}

      <div className="bg-white border rounded-[2rem] overflow-hidden"><div className="p-5 border-b flex items-center gap-3"><History className="w-5 h-5 text-slate-500"/><div><h3 className="font-black">Historial de lotes</h3><p className="text-xs text-slate-500">Trazabilidad de cargas anteriores.</p></div></div><div className="divide-y">{batches.length===0?<div className="p-10 text-center text-slate-400">Aún no hay lotes de migración.</div>:batches.map(b=><div key={b.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"><div><p className="font-black">{b.original_filename}</p><p className="text-xs text-slate-500">{legacyProfileLabel(b.profile_key)} · {new Date(b.created_at).toLocaleString('es-CO')}</p></div><div className="flex gap-2 flex-wrap text-[9px] font-black uppercase"><span className="px-2 py-1 rounded-full bg-slate-100">{labelMigrationStatus(b.status)}</span><span className="px-2 py-1 rounded-full bg-green-50 text-green-700">{b.imported_count} importados</span>{b.review_count>0&&<span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">{b.review_count} revisión</span>}{b.error_count>0&&<span className="px-2 py-1 rounded-full bg-red-50 text-red-700">{b.error_count} error</span>}</div></div>)}</div></div>
    </div>
  </DashboardLayout>;
};

export default LegacyMigrationCenterPage;

