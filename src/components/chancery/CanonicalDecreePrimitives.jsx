import React from 'react';
import { AlertTriangle, BookCopy, ShieldCheck, Search, Church, CheckCircle2 } from 'lucide-react';



export const CanonicalParishSelector = ({
  parishes = [],
  value = '',
  onChange,
  query = '',
  onQueryChange,
  disabled = false,
  loading = false,
  label = 'Parroquia',
  placeholder = 'Buscar parroquia',
  emptyText = 'No hay parroquias disponibles en esta jurisdicción.'
}) => {
  const q = String(query || '').trim().toLowerCase();
  const filtered = q
    ? parishes.filter((p) => `${p?.name || ''} ${p?.city || ''}`.toLowerCase().includes(q))
    : parishes;

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            disabled={disabled || loading}
            onChange={(e) => onQueryChange?.(e.target.value)}
            placeholder={placeholder}
            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
        </div>
      </div>

      <div className="max-h-52 overflow-auto rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs font-semibold text-slate-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
            Cargando parroquias de la jurisdicción…
          </div>
        ) : filtered.length ? filtered.map((parish) => {
          const active = String(value || '') === String(parish.id || '');
          return (
            <button
              key={parish.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(parish.id, parish)}
              className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition last:border-b-0 ${active ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : 'hover:bg-slate-50'} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                <Church className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black uppercase leading-snug text-slate-900">{parish.name}</span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-slate-400">{parish.city || 'Jurisdicción diocesana'}</span>
                {active ? <span className="mt-1 inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-blue-700"><CheckCircle2 className="h-3.5 w-3.5" /> Seleccionada</span> : null}
              </span>
              {active ? <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-700" /> : null}
            </button>
          );
        }) : (
          <div className="px-4 py-8 text-center text-xs text-slate-400">{emptyText}</div>
        )}
      </div>
    </div>
  );
};

export const CanonicalRecordFinder = ({
  enabled = false,
  loading = false,
  query = '',
  onQueryChange,
  placeholder = 'Buscar por nombre, L/F/N o registro',
  records = [],
  selectedId = '',
  onSelect,
  getId = (row) => row?.id,
  getTitle = (row) => row?.name || 'Partida',
  getSubtitle = () => '',
  getLocation = () => '',
  getRegistry = () => '',
  getStatusLabel = () => 'ASENTADA',
  getStatusClass = () => 'border-green-200 bg-green-50 text-green-700',
  isSelectable = () => true,
  emptyText = 'No se encontraron partidas en esta parroquia.'
}) => (
  <div className="mt-5 border-t border-slate-100 pt-4">
    <p className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
      Partida original dentro de la parroquia
    </p>

    {!enabled ? (
      <div className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
        Seleccione primero la parroquia.
      </div>
    ) : (
      <>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange?.(e.target.value)}
            placeholder={placeholder}
            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="-mx-5 mt-4 max-h-[410px] divide-y overflow-auto border-t border-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs font-semibold text-slate-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
              Consultando partidas…
            </div>
          ) : records.length ? records.map((row) => {
            const id = getId(row);
            const active = String(selectedId || '') === String(id || '');
            const selectable = isSelectable(row);
            const subtitle = getSubtitle(row);
            const location = getLocation(row);
            const registry = getRegistry(row);
            return (
              <button
                key={id}
                type="button"
                disabled={!selectable}
                onClick={() => onSelect?.(row)}
                className={[
                  'w-full p-4 text-left transition-colors',
                  active
                    ? 'bg-blue-50 ring-1 ring-inset ring-blue-200'
                    : selectable
                      ? 'hover:bg-slate-50'
                      : 'cursor-not-allowed bg-slate-50/60 opacity-65'
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black uppercase leading-snug text-slate-900">{getTitle(row)}</div>
                    {subtitle ? <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{subtitle}</div> : null}
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-black uppercase ${getStatusClass(row)}`}>
                    {getStatusLabel(row)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
                  {location ? <span className="font-mono font-bold">{location}</span> : null}
                  {registry ? <span className="font-mono">REG. {registry}</span> : null}
                  {active ? <span className="ml-auto font-black uppercase tracking-wider text-blue-700">Seleccionada</span> : null}
                </div>
              </button>
            );
          }) : (
            <div className="px-4 py-8 text-center text-xs text-slate-400">{emptyText}</div>
          )}
        </div>
      </>
    )}
  </div>
);

export const CanonicalField = ({ label, children, className = '' }) => (
  <div className={className}>
    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
      {label}
    </label>
    {children}
  </div>
);

export const CanonicalSectionTitle = ({ title, subtitle }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 h-6 w-1 rounded-full bg-slate-900" />
    <div>
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">{title}</h3>
      {subtitle ? <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{subtitle}</p> : null}
    </div>
  </div>
);

export const CanonicalMasterPanel = ({ kicker, children, footer }) => (
  <section className="min-w-0 self-start overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{kicker}</p>
      <div className="mt-3">{children}</div>
    </div>
    {footer ? <div>{footer}</div> : null}
  </section>
);

export const CanonicalEmptyPanel = ({ title, text }) => (
  <section className="flex min-h-[560px] min-w-0 flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
    <ShieldCheck className="mb-4 h-12 w-12 text-slate-300" />
    <p className="font-black text-slate-700">{title}</p>
    <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-400">{text}</p>
  </section>
);

export const CanonicalDetailPanel = ({ children }) => (
  <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">{children}</section>
);

export const CanonicalDetailHeader = ({ kicker = '02 · Expediente del decreto', title, subtitle, right }) => (
  <div className="border-b border-slate-100 p-6 md:p-7">
    <div className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{kicker}</p>
      <h2 className="mt-1 break-words text-lg font-black uppercase leading-tight text-slate-950 md:text-xl">{title}</h2>
      {subtitle ? <p className="mt-1 break-words text-xs leading-relaxed text-slate-500">{subtitle}</p> : null}
    </div>
    {right ? <div className="mt-5 w-full min-w-0">{right}</div> : null}
  </div>
);

export const CanonicalDecreeMetaGrid = ({ children }) => (
  <div className="grid min-w-0 gap-3 md:grid-cols-3">{children}</div>
);

export const CanonicalDetailBody = ({ children }) => (
  <div className="space-y-7 p-6 md:p-7">{children}</div>
);

export const CanonicalReasonPanel = ({ value, onChange, placeholder }) => (
  <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
    <label className="text-[10px] font-black uppercase tracking-widest text-blue-800">Fundamento / explicación del decreto</label>
    <textarea
      className="mt-2 min-h-28 w-full rounded-xl border border-blue-200 bg-white p-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
    />
  </section>
);

export const PreviewBox = ({ label, value }) => (
  <div className="rounded-xl border border-amber-200 bg-white px-3 py-2">
    <div className="text-[8px] font-black uppercase tracking-widest text-amber-700">{label}</div>
    <div className="mt-1 font-mono text-sm font-black text-slate-950">{value || '—'}</div>
  </div>
);

export const CanonicalSupplementaryPreview = ({ book, folio, number, registry, blocked = false }) => (
  <div className="border-b border-amber-100 bg-amber-50/70 p-6 md:p-7">
    <div className="flex items-start gap-3">
      <BookCopy className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase text-amber-900">Próxima ubicación supletoria</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <PreviewBox label="Libro" value={book} />
          <PreviewBox label="Folio" value={folio} />
          <PreviewBox label="Número" value={number} />
          <PreviewBox label="N.º Registro" value={registry || 'AUTOMÁTICO'} />
        </div>
        {blocked ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            <AlertTriangle className="h-4 w-4" /> El Libro Supletorio está bloqueado.
          </div>
        ) : null}
        <p className="mt-3 text-[10px] leading-relaxed text-amber-800">
          La vista previa no reserva números. PostgreSQL vuelve a validar y consume el consecutivo al emitir.
        </p>
      </div>
    </div>
  </div>
);

export const CanonicalNotice = ({ tone = 'blue', title, text }) => {
  const cls = tone === 'rose'
    ? 'border-red-100 bg-red-50/70 text-red-800'
    : tone === 'amber'
      ? 'border-amber-200 bg-amber-50/70 text-amber-800'
      : 'border-blue-100 bg-blue-50/70 text-blue-800';

  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <p className="text-xs font-black uppercase">{title}</p>
      <p className="mt-1 text-[10px] leading-relaxed">{text}</p>
    </div>
  );
};

export const CanonicalActionFooter = ({ children }) => (
  <div className="border-t border-slate-100 bg-slate-50/70 p-5">{children}</div>
);

export const canonicalInputClass =
  'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200';

export const canonicalSelectClass =
  'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200';

export const canonicalTextareaClass =
  'min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200';

export const EVIDENCE_TYPES = [
  'Certificación parroquial',
  'Constancia del ministro',
  'Libro o índice auxiliar',
  'Documento civil o eclesiástico',
  'Testimonio documentado',
  'Otro documento probatorio'
];
