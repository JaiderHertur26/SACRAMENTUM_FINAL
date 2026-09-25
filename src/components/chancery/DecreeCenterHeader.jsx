import { useNavigate } from 'react-router-dom';
import {
  ScrollText,
  FileCheck2,
  ArchiveRestore,
  History,
  Church,
  HeartHandshake,
  Heart,
  ShieldCheck,
  ArrowLeft,
  Eye
} from 'lucide-react';

export const DECREE_OPERATION_META = Object.freeze({
  correction: {
    label: 'Corrección',
    subtitle: 'Existe una partida con error: la original queda anulada y se crea una nueva partida supletoria vinculada.',
    icon: FileCheck2
  },
  reposition: {
    label: 'Reposición',
    subtitle: 'No existe una partida utilizable: se crea una nueva partida supletoria con fundamento documental suficiente.',
    icon: ArchiveRestore
  },
  archive: {
    label: 'Archivo',
    subtitle: 'Consulta, impresión y trazabilidad institucional de los decretos emitidos.',
    icon: History
  }
});

export const DECREE_SACRAMENT_META = Object.freeze({
  bautismo: {
    label: 'Bautismo',
    icon: Church,
    description: 'Corrección y reposición de partidas bautismales.'
  },
  confirmacion: {
    label: 'Confirmación',
    icon: HeartHandshake,
    description: 'Corrección y reposición de partidas de Confirmación.'
  },
  matrimonio: {
    label: 'Matrimonio',
    icon: Heart,
    description: 'Corrección y reposición del registro matrimonial. La nulidad no pertenece a este Centro.'
  },
  exequias: {
    label: 'Exequias',
    icon: ScrollText,
    description: 'Corrección y reposición de partidas de Exequias.'
  }
});

const centerPath = (scope) => scope === 'parish' ? '/parroquia/decretos' : '/chancery/decretos';

export const decreeRouteFor = (mode, sacrament, scope = 'chancery') => {
  const sacramentKey = sacrament || 'bautismo';

  if (scope === 'parish') {
    const params = new URLSearchParams();
    if (mode && mode !== 'archive') params.set('type', mode === 'reposition' ? 'reposicion' : 'correccion');
    params.set('sacrament', sacramentKey);
    return `/parroquia/decretos/archivo?${params.toString()}`;
  }

  if (mode === 'archive') {
    return `/chancery/decretos/archivo?sacrament=${encodeURIComponent(sacramentKey)}`;
  }

  const correction = {
    bautismo: '/chancery/decree-correction/new',
    confirmacion: '/chancery/decree-correction/new-confirmation',
    matrimonio: '/chancery/matrimonio/decretos?mode=correction',
    exequias: '/chancery/exequias/decretos?mode=correction'
  };

  const reposition = {
    bautismo: '/chancery/decree-replacement/new',
    confirmacion: '/chancery/decree-replacement/new-confirmation',
    matrimonio: '/chancery/matrimonio/decretos?mode=reposition',
    exequias: '/chancery/exequias/decretos?mode=reposition'
  };

  return (mode === 'reposition' ? reposition : correction)[sacramentKey];
};

const DecreeCenterHeader = ({
  mode = null,
  sacrament = null,
  scope = 'chancery',
  title = 'Centro de Decretos Sacramentales',
  subtitle,
  showBack = false
}) => {
  const navigate = useNavigate();
  const isParish = scope === 'parish';

  const resolvedSubtitle = subtitle || (
    isParish
      ? 'Recepción, consulta e impresión de decretos de Corrección y Reposición emitidos por Cancillería para Bautismo, Confirmación, Matrimonio y Exequias.'
      : 'Gobierno documental unificado de Corrección y Reposición para Bautismo, Confirmación, Matrimonio y Exequias.'
  );

  const switchMode = (nextMode) => {
    const targetSacrament = sacrament || 'bautismo';
    navigate(decreeRouteFor(nextMode, targetSacrament, scope));
  };

  const switchSacrament = (nextSacrament) => {
    const targetMode = mode || 'archive';
    navigate(decreeRouteFor(targetMode, nextSacrament, scope));
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-7 py-7 text-white md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {showBack ? (
            <button
              type="button"
              onClick={() => navigate(centerPath(scope))}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition hover:bg-white/15"
              aria-label="Volver al Centro de Decretos"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <ScrollText className="h-7 w-7 text-white" />
            </div>
          )}

          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-amber-300">
              {isParish ? 'Parroquia · Decretos recibidos de Cancillería' : 'Cancillería · Gobierno Documental'}
            </p>
            <h1 className="mt-1 font-serif text-3xl font-black text-white">{title}</h1>
            <p className="mt-1 max-w-3xl text-xs text-slate-300">{resolvedSubtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(centerPath(scope))}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-200 transition hover:bg-white/10 md:self-auto"
        >
          {isParish ? <Eye className="h-4 w-4 text-amber-300" /> : <ShieldCheck className="h-4 w-4 text-amber-300" />}
          {isParish ? 'Centro parroquial' : 'Centro unificado'}
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(DECREE_OPERATION_META).map(([key, meta]) => {
            const Icon = meta.icon;
            const active = mode === key;
            const subtitleText = isParish && key === 'archive'
              ? 'Consulta, impresión y trazabilidad. La reversión corresponde exclusivamente a Cancillería.'
              : meta.subtitle;

            return (
              <button
                key={key}
                type="button"
                onClick={() => switchMode(key)}
                className={[
                  'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
                  active
                    ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                ].join(' ')}
              >
                <span className={['flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', active ? 'bg-white/10' : 'bg-slate-100'].join(' ')}>
                  <Icon className={active ? 'h-5 w-5 !text-white' : 'h-5 w-5 text-slate-700'} />
                </span>
                <span>
                  <span className={active ? 'block text-xs font-black uppercase tracking-wide !text-white' : 'block text-xs font-black uppercase tracking-wide text-slate-800'}>{meta.label}</span>
                  <span className={active ? 'mt-0.5 block text-[10px] !text-slate-200' : 'mt-0.5 block text-[10px] text-slate-400'}>
                    {subtitleText}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2 md:grid-cols-4">
          {Object.entries(DECREE_SACRAMENT_META).map(([key, meta]) => {
            const Icon = meta.icon;
            const active = sacrament === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => switchSacrament(key)}
                className={[
                  'flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all',
                  active
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default DecreeCenterHeader;
