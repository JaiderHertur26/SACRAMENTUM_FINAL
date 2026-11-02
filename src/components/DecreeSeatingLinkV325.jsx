import React from 'react';
import { Link } from 'react-router-dom';
import { ScrollText, ArrowRight } from 'lucide-react';
export default function DecreeSeatingLinkV325() {
  return <Link to="/parroquia/decretos?view=asiento" className="mb-5 flex items-center gap-3 rounded-2xl border border-[#dfcbbc] bg-[#fffaf1] p-4 text-[#682b3e] print:hidden">
    <ScrollText className="h-5 w-5 shrink-0" aria-hidden="true" />
    <span className="min-w-0 flex-1"><strong className="block text-sm">Decretos por sentar</strong>
      <span className="mt-1 block text-xs">Revise la bandeja de decretos y confirme allí el Libro, Folio y Número del asiento.</span></span>
    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
  </Link>;
}
