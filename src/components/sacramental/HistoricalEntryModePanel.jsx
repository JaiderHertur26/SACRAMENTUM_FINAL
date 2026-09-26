import React from 'react';
import { BookOpenText, ListTree, ScrollText } from 'lucide-react';

const modeMeta = {
  structured: {
    label: 'Registro por campos',
    description: 'Para libros donde los datos aparecen separados: nombres, fechas, padres, ministro y demás campos.',
    icon: ListTree
  },
  narrative: {
    label: 'Texto completo / Transcripción literal',
    description: 'Para libros donde la partida está redactada como un solo cuerpo de texto, sin campos separados.',
    icon: ScrollText
  }
};

const HistoricalEntryModePanel = ({
  mode = 'structured',
  onModeChange,
  transcription = '',
  onTranscriptionChange,
  sacramentLabel = 'sacramental',
  compact = false
}) => (
  <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
    <div className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-amber-50/40 p-5 md:p-6">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-white text-amber-700 shadow-sm">
        <BookOpenText className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#4B7BA7]">Partida ya celebrada y registrada en el libro</p>
        <h3 className="mt-1 font-serif text-xl font-black text-slate-950">Seleccione cómo está escrito el asiento original</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Use campos separados solamente cuando así consten en el libro. Si el asiento antiguo es un único cuerpo de texto, consérvelo literalmente.
        </p>
      </div>
    </div>

    <div role="tablist" aria-label="Modo de registro del asiento histórico" className="mx-5 mb-4 mt-5 grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 md:mx-6">
      {Object.entries(modeMeta).map(([key, meta]) => {
        const Icon = meta.icon;
        const active = mode === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onModeChange?.(key)}
            className={[
              'rounded-xl border p-4 text-left transition-all',
              active
                ? 'border-[#4B7BA7] bg-white text-slate-950 shadow-sm ring-1 ring-[#4B7BA7]/10'
                : 'border-transparent bg-transparent text-slate-500 hover:bg-white/70 hover:text-slate-800'
            ].join(' ')}
          >
            <div className="flex items-start gap-3">
              <span className={['flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', active ? 'bg-blue-50' : 'bg-white/80'].join(' ')}>
                <Icon className={active ? 'h-4 w-4 text-[#4B7BA7]' : 'h-4 w-4 text-slate-500'} />
              </span>
              <span>
                <span className={active ? 'block text-xs font-black uppercase tracking-wide text-[#315E86]' : 'block text-xs font-black uppercase tracking-wide text-slate-700'}>
                  {meta.label}
                </span>
                <span className={active ? 'mt-1 block text-[10px] leading-relaxed text-slate-600' : 'mt-1 block text-[10px] leading-relaxed text-slate-500'}>
                  {meta.description}
                </span>
              </span>
            </div>
          </button>
        );
      })}
    </div>

    {mode === 'narrative' ? (
      <div role="tabpanel" className="mx-5 mb-5 space-y-4 rounded-2xl border border-amber-200 bg-[#fffdf8] p-5 md:mx-6 md:mb-6">
        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
            Cuerpo completo de la partida tal como aparece en el libro
          </label>
          <textarea
            required
            value={transcription}
            onChange={(e) => onTranscriptionChange?.(e.target.value)}
            className={[
              'w-full resize-y rounded-2xl border border-slate-200 bg-[#fffdf8] p-5 font-serif text-[15px] leading-7 text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5',
              compact ? 'min-h-56' : 'min-h-72'
            ].join(' ')}
            placeholder={'Transcriba aquí exactamente el asiento de ' + sacramentLabel + ' tal como aparece en el libro físico. Conserve nombres, abreviaturas, puntuación, grafía y orden originales.'}
          />
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[10px] leading-relaxed text-blue-800">
          <strong>Fidelidad documental:</strong> SACRAMENTUM guardará este texto sin convertirlo automáticamente a mayúsculas ni reescribirlo. Libro, Folio y Número seguirán siendo la identificación canónica del asiento.
        </div>
      </div>
    ) : null}
  </section>
);

export default HistoricalEntryModePanel;
