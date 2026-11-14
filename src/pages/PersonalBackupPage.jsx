import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ShieldCheck, Upload } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { getDashboardPathForRole } from '@/lib/authz';
import { BACKUP_MAX_FILE_SIZE, downloadBackup, validateBackup } from '@/lib/backupHelpers';
import {
  exportPersonalBackup, importPersonalBackup, loadPersonalBackup, readPersonalBackupSection
} from '@/services/personalBackupService';

const SCOPE = {
  parish: 'Partidas, boletas pendientes, expedientes, notas, decretos recibidos, párrocos, Mis Datos y parámetros de su parroquia.',
  diocese: 'Estructura de su diócesis, parroquias, vicarías, decanatos e informes generados por su cuenta.',
  chancery: 'Decretos, avisos, constancias, conceptos y datos de su Cancillería.',
  admin_general: 'Directorio institucional de arquidiócesis, diócesis y parroquias.'
};

const SECTION = {
  parroquias: 'Parroquias', parrocos: 'Párrocos', mis_datos: 'Mis Datos', parametros: 'Parámetros',
  bautismos: 'Bautismos', confirmaciones: 'Confirmaciones', matrimonios: 'Matrimonios', exequias: 'Exequias',
  bautismos_pendientes: 'Bautismos pendientes', confirmaciones_pendientes: 'Confirmaciones pendientes',
  matrimonios_pendientes: 'Matrimonios pendientes', exequias_pendientes: 'Exequias pendientes',
  expedientes: 'Expedientes matrimoniales', notas_marginales: 'Notas marginales', decretos: 'Decretos',
  diocesis: 'Diócesis', vicarias: 'Vicarías', decanatos: 'Decanatos', informes: 'Informes',
  cancilleria: 'Cancillería', conceptos: 'Conceptos', avisos_decretos: 'Avisos de decretos',
  constancias_decretos: 'Constancias de decretos', arquidiocesis: 'Arquidiócesis'
};
const dateTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
const formatDate = (value) => dateTime.format(new Date(value));
const pageSize = 25;

function RecordList({ rows, offset }) {
  return rows.map((row, index) => {
    const raw = row?.raw_data;
    const names = [row?.nombres || raw?.nombres || raw?.firstName, row?.apellidos || raw?.apellidos || raw?.lastName]
      .filter(Boolean).join(' ');
    const spouses = [
      [raw?.novioNombres, raw?.novioApellidos].filter(Boolean).join(' '),
      [raw?.noviaNombres, raw?.noviaApellidos].filter(Boolean).join(' ')
    ].filter(Boolean).join(' y ');
    const description = row?.nombre || row?.name || row?.decree_number || row?.subject || row?.concepto
      || row?.report_number || row?.dossier_number || names || spouses || row?.numero_registro
      || `Registro ${offset + index + 1}`;
    const coordinates = row?.book_number && row?.folio && row?.number
      ? ` · Libro ${row.book_number} · Folio ${row.folio} · Número ${row.number}` : '';
    return (
      <details key={row?.id || row?.decree_id || offset + index} className="rounded-xl border border-stone-200 bg-white">
        <summary className="cursor-pointer break-words px-4 py-3 text-sm font-medium text-stone-800">
          {description}{coordinates}
        </summary>
        <pre className="overflow-x-auto whitespace-pre-wrap break-words border-t border-stone-100 bg-stone-50 p-4 text-xs">
          {JSON.stringify(row, null, 2)}
        </pre>
      </details>
    );
  });
}

function BackupWorkspace({ role }) {
  const [copy, setCopy] = useState(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState('status');
  const [selected, setSelected] = useState(null);
  const [section, setSection] = useState('');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sectionError, setSectionError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const lifetime = useRef(null);
  const running = useRef(false);
  const fileInput = useRef(null);
  const copyId = copy?.id;

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    setBusy('status');
    setReady(false);
    setError('');
    loadPersonalBackup(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.role !== role) throw new Error('La sesión y el rol activo no coinciden. Vuelva a iniciar sesión.');
        setCopy(data.copy);
        setReady(true);
      })
      .catch((issue) => {
        if (!controller.signal.aborted) setError(issue.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy('');
      });
    return () => controller.abort();
  }, [role, refresh]);

  useEffect(() => {
    setPage(null);
    setSectionError('');
    if (!copyId || !section) return;
    const controller = new AbortController();
    readPersonalBackupSection(copyId, section, offset, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setPage(data); })
      .catch((issue) => { if (!controller.signal.aborted) setSectionError(issue.message); });
    return () => controller.abort();
  }, [copyId, section, offset]);

  async function run(action, task) {
    const signal = lifetime.current?.signal;
    if (!ready || busy || running.current || !signal || signal.aborted) return;
    running.current = true;
    setBusy(action);
    setError('');
    setMessage('');
    try {
      await task(signal);
    } catch (issue) {
      if (!signal.aborted) setError(issue.message || 'No se pudo completar la operación.');
    } finally {
      running.current = false;
      if (!signal.aborted) setBusy('');
    }
  }

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setSelected(null);
    if (!file) return;
    await run('file', async (signal) => {
      if (file.size > BACKUP_MAX_FILE_SIZE) throw new Error('El archivo supera el límite de 18 MB.');
      let contents;
      try {
        contents = JSON.parse(await file.text());
      } catch {
        throw new Error('El archivo seleccionado no se pudo leer como copia de seguridad.');
      }
      const envelope = validateBackup(contents, role);
      if (!signal.aborted) setSelected({ filename: file.name, envelope });
    });
  }

  function exportFile() {
    return run('export', async (signal) => {
      const data = await exportPersonalBackup(signal);
      if (!signal.aborted) {
        downloadBackup(validateBackup(data, role));
        setMessage('Copia descargada.');
      }
    });
  }

  function importFile() {
    return run('import', async (signal) => {
      const restored = await importPersonalBackup(selected.envelope, signal);
      if (!signal.aborted) {
        setCopy(restored);
        setSection('');
        setOffset(0);
        setSelected(null);
        setMessage('Copia importada en su archivo personal.');
      }
    });
  }

  function refreshCopy() {
    setSection('');
    setOffset(0);
    setPage(null);
    setMessage('');
    setRefresh((value) => value + 1);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-12 sm:px-6">
      <Link to={getDashboardPathForRole(role)} className="inline-flex items-center gap-2 text-sm font-semibold text-stone-700 hover:underline">
        <ArrowLeft size={16} aria-hidden="true" /> Volver al centro de mando
      </Link>
      <header className="rounded-3xl border border-[#e4d9be] bg-[#fbf8ef] p-6 sm:p-8">
        <ShieldCheck className="mb-3 text-[#7b5b23]" aria-hidden="true" size={30} />
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#552536] sm:text-4xl">Copia de seguridad</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-700">{SCOPE[role]}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
          <h2 className="font-serif text-xl font-semibold text-stone-900">Exportar copia</h2>
          <p className="mb-4 mt-2 text-sm text-stone-600">Descargue un archivo cifrado para abrirlo con esta misma cuenta.</p>
          <Button type="button" disabled={!ready || Boolean(busy)} onClick={exportFile}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            {busy === 'export' ? 'Preparando copia…' : 'Exportar copia'}
          </Button>
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
          <h2 className="font-serif text-xl font-semibold text-stone-900">Importar copia</h2>
          <p className="mb-4 mt-2 text-sm text-stone-600">
            Abra una copia en su archivo personal de consulta. Si ya tiene una allí, la copia nueva la sustituye.
          </p>
          <input ref={fileInput} type="file" accept=".json,application/json" onChange={chooseFile}
            aria-label="Archivo de copia de seguridad" hidden />
          <Button type="button" variant="outline" disabled={!ready || Boolean(busy)} onClick={() => fileInput.current?.click()}>
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            {busy === 'file' ? 'Leyendo archivo…' : 'Seleccionar archivo'}
          </Button>
          {selected && (
            <div className="mt-4 space-y-3 rounded-xl bg-stone-50 p-3 text-sm">
              <p className="break-all font-medium">{selected.filename}</p>
              <p className="text-stone-600">Fecha de la copia · {formatDate(selected.envelope.exportedAt)}</p>
              <Button type="button" disabled={Boolean(busy)} onClick={importFile}>
                {busy === 'import' ? 'Importando…' : 'Importar a mi archivo'}
              </Button>
            </div>
          )}
        </section>
      </div>
      {busy === 'status' && <p role="status" className="text-sm text-stone-600">Cargando su archivo personal…</p>}
      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{message}</p>}
      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">
          <p>{error}</p>
          {!ready && <Button type="button" variant="outline" className="mt-3" onClick={refreshCopy}>Reintentar</Button>}
        </div>
      )}
      {ready && (
        <section className="space-y-4 rounded-2xl border border-stone-200 bg-[#fbf8ef] p-5 sm:p-6">
          <h2 className="font-serif text-xl font-semibold text-[#552536]">Mi copia importada</h2>
          {copy ? (
            <>
              <p className="text-sm text-stone-700">Copia del {formatDate(copy.exportedAt)}</p>
              <label className="block max-w-sm text-sm font-semibold text-stone-800">
                Sección
                <select className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-normal"
                  value={section} onChange={(event) => { setSection(event.target.value); setOffset(0); }}>
                  <option value="">Seleccione una sección</option>
                  {Object.entries(copy.sections).map(([key, count]) => (
                    <option key={key} value={key}>{SECTION[key] || key} ({count})</option>
                  ))}
                </select>
              </label>
              {sectionError && (
                <div role="alert" className="space-y-2 text-sm text-rose-900">
                  <p>{sectionError}</p>
                  <Button type="button" variant="outline" onClick={refreshCopy} disabled={Boolean(busy)}>
                    Volver a consultar mi copia
                  </Button>
                </div>
              )}
              {section && !page && !sectionError && <p role="status" className="text-sm text-stone-600">Cargando sección…</p>}
              {page?.total === 0 && <p className="text-sm text-stone-600">Esta sección está vacía.</p>}
              {page?.total > 0 && (
                <div className="space-y-2">
                  <RecordList rows={page.rows} offset={offset} />
                  {page.total > pageSize && (
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <Button type="button" variant="outline" disabled={offset === 0} onClick={() => setOffset(offset - pageSize)}>
                        <ChevronLeft size={16} aria-hidden="true" /> Anterior
                      </Button>
                      <p className="text-sm text-stone-700">{offset + 1}–{offset + page.rows.length} de {page.total}</p>
                      <Button type="button" variant="outline" disabled={offset + pageSize >= page.total} onClick={() => setOffset(offset + pageSize)}>
                        Siguiente <ChevronRight size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : <p className="text-sm text-stone-600">Todavía no ha importado una copia.</p>}
        </section>
      )}
    </div>
  );
}

export default function PersonalBackupPage() {
  const { session, profile, role, parishId, dioceseId, chanceryId, user } = useAuth();
  const identity = [session?.user?.id || user?.id, profile?.id, role, parishId, dioceseId, chanceryId].join('/');
  if (!Object.hasOwn(SCOPE, role)) return null;
  return (
    <DashboardLayout commandCenter>
      <BackupWorkspace key={identity} role={role} />
    </DashboardLayout>
  );
}
