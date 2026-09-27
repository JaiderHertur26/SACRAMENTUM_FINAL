import React from 'react';
import { FileText, BookOpenCheck, ScrollText, ShieldCheck } from 'lucide-react';
import { decreeConceptBookLabel, normalizeDecreeConceptPolicy } from '@/utils/decreeConceptPolicy';

const Pill = ({ children }) => (
  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-600">
    {children}
  </span>
);

export default function DecreeConceptEffects({ concept }) {
  if (!concept) return null;
  const policy = normalizeDecreeConceptPolicy(concept);

  return <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
    <div className="flex items-start gap-3">
      <ShieldCheck className="mt-0.5 h-4 w-4 text-blue-700" />
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-blue-700">Efectos definidos por el concepto</p>
        <p className="mt-1 text-xs font-bold text-slate-800">{policy.code ? policy.code + ' · ' : ''}{policy.concept || 'Concepto seleccionado'}</p>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {policy.registersEffect && <Pill><BookOpenCheck className="mr-1 inline h-3 w-3"/>Inscripción</Pill>}
      {policy.generatesMarginalNote && <Pill><ScrollText className="mr-1 inline h-3 w-3"/>Nota marginal</Pill>}
      {policy.generatesDocument && <Pill><FileText className="mr-1 inline h-3 w-3"/>Documento</Pill>}
      <Pill>Libro: {decreeConceptBookLabel(policy.bookMode)}</Pill>
      {policy.issuer && <Pill>Expide: {policy.issuer}</Pill>}
    </div>
  </div>;
}