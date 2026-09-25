import React from 'react';
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
  ArrowLeft
} from 'lucide-react';

const OPERATION_META = {
  correction: {
    label: 'Corrección',
    subtitle: 'Anula la partida original y crea una nueva supletoria',
    icon: FileCheck2
  },
  reposition: {
    label: 'Reposición',
    subtitle: 'No existe partida utilizable: se reconstruye con evidencia',
    icon: ArchiveRestore
  },
  archive: {
    label: 'Archivo',
    subtitle: 'Consulta, impresión y reversión auditada',
    icon: History
  }
};

const SACRAMENT_META = {
  bautismo: { label: 'Bautismo', icon: Church },
  confirmacion: { label: 'Confirmación', icon: HeartHandshake },
  matrimonio: { label: 'Matrimonio', icon: Heart },
  exequias: { label: 'Exequias', icon: ScrollText }
};

export const decreeRouteFor = (mode, sacrament) => {
  if (mode === 'archive') {
    return `/chancery/decretos/archivo?sacrament=${encodeURIComponent(sacrament || 'bautismo')}`;
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

  return (mode === 'reposition' ? reposition : correction)[sacrament || 'bautismo'];
};

const DecreeCenterHeader = ({
  mode = null,
  sacrament = null,
  title = 'Centro de Decretos Sacramentales',
  subtitle = 'Gobierno documental unificado de Bautismo, Confirmación, Matrimonio y Exequias.',
  showBack = false
}) => {
  const navigate = useNavigate();

  const switchMode = (nextMode) => {
    const targetSacrament = sacrament || 'bautismo';
    navigate(decreeRouteFor(nextMode, targetSacrament));
  };

  const switchSacrament = (nextSacrament) => {
    const targetMode = mode || 'correction';
    navigate(decreeRouteFor(targetMode, nextSacrament));
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-7 py-7 text-white md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {showBack ? (
            <button
              type="button"
              onClick={() => navigate('/chancery/decretos')}
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
              Cancillería · Gobierno Documental
            </p>
            <h1 className="mt-1 font-serif text-3xl font-black text-white">{title}</h1>
            <p className="mt-1 max-w-3xl text-xs text-slate-300">{subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/chancery/decretos')}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-200 transition hover:bg-white/10 md:self-auto"
        >
          <ShieldCheck className="h-4 w-4 text-amber-300" />
          Centro unificado
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(OPERATION_META).map(([key, meta]) => {
            const Icon = meta.icon;
            const active = mode === key;
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
                    {meta.subtitle}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2 md:grid-cols-4">
          {Object.entries(SACRAMENT_META).map(([key, meta]) => {
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
