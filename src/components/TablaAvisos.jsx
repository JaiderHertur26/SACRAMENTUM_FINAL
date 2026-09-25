import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, CheckCircle2, Circle, Archive, MailOpen, Mail, Link2 } from 'lucide-react';

const formatShortDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric'
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
};

const StatusBadge = ({ status }) => {
  if (status === 'aceptada') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
        <CheckCircle2 className="h-3 w-3" /> Aceptada
      </span>
    );
  }
  if (status === 'leida') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
        <MailOpen className="h-3 w-3" /> Leída · pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
      <Circle className="h-3 w-3 fill-blue-500 text-blue-500" /> Sin leer
    </span>
  );
};

const TablaAvisos = ({
  avisos = [],
  onViewAviso,
  onMarkAsViewed,
  onDeleteAviso,
  currentParishName
}) => {
  // Regla institucional: siempre prevalece la fecha más reciente.
  const sortedAvisos = [...avisos].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Bautizado(a)</th>
              <th className="px-4 py-3">Parroquia origen</th>
              <th className="px-4 py-3">Referencia</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedAvisos.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-12 text-center text-slate-400">
                  No se encontraron notificaciones sacramentales.
                </td>
              </tr>
            ) : sortedAvisos.map((aviso) => {
              const doc = aviso.document || {};
              const accepted = aviso.status === 'aceptada';
              const typeKey = String(doc.notificationType || 'matrimonio').toLowerCase();
              const manualUnlinked = !aviso.targetBaptismId
                && Boolean(aviso.payload?.manualLocator?.book && aviso.payload?.manualLocator?.folio && aviso.payload?.manualLocator?.number);
              const typeLabel = typeKey === 'nulidad_matrimonial'
                ? 'Nulidad matrimonial'
                : typeKey === 'matrimonio'
                  ? 'Matrimonio'
                  : typeKey.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
              const reference = typeKey === 'matrimonio'
                ? [
                    manualUnlinked
                      ? `Partida física L.${aviso.payload.manualLocator.book} F.${aviso.payload.manualLocator.folio} N.${aviso.payload.manualLocator.number}`
                      : null,
                    doc.spouseName ? `Matrimonio con ${doc.spouseName}` : 'Notificación matrimonial',
                    doc.marriageDate ? formatShortDate(doc.marriageDate) : null
                  ].filter(Boolean).join(' · ')
                : typeKey === 'nulidad_matrimonial'
                  ? [
                      doc.decreeNumber ? `Decreto/Sentencia ${doc.decreeNumber}` : 'Nulidad matrimonial',
                      doc.decreeDate ? formatShortDate(doc.decreeDate) : null
                    ].filter(Boolean).join(' · ')
                  : (doc.documentNumber || aviso.consecutivo || 'Notificación sacramental');

              return (
                <tr
                  key={aviso.id}
                  className={`${aviso.status === 'sin_leer' ? 'bg-blue-50/35' : 'bg-white'} transition hover:bg-slate-50`}
                >
                  <td className="px-4 py-4"><StatusBadge status={aviso.status} /></td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-500">{formatShortDate(aviso.createdAt)}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black tracking-wider text-slate-600">
                      <Mail className="h-3 w-3" /> {typeLabel}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-bold uppercase text-slate-900">{aviso.personName || doc.personName || '-'}</td>
                  <td className="px-4 py-4 text-slate-600">{aviso.senderParishName || doc.senderParishName || 'Parroquia emisora'}</td>
                  <td className="px-4 py-4 text-xs text-slate-500">{reference}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewAviso?.(aviso)}
                        className="h-8 border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" /> Leer
                      </Button>
                      {!accepted && (
                        <Button
                          size="sm"
                          onClick={() => manualUnlinked ? onViewAviso?.(aviso) : onMarkAsViewed?.(aviso)}
                          className={manualUnlinked
                            ? "h-8 bg-amber-500 text-white hover:bg-amber-600"
                            : "h-8 bg-green-600 text-white hover:bg-green-700"}
                          title={manualUnlinked
                            ? 'Resolver partida física antes de aceptar'
                            : 'Aceptar notificación'}
                        >
                          {manualUnlinked
                            ? <><Link2 className="mr-1 h-3.5 w-3.5" /> Resolver</>
                            : <><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aceptar</>}
                        </Button>
                      )}
                      {onDeleteAviso && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteAviso(aviso)}
                          className="h-8 text-red-500 hover:bg-red-50 hover:text-red-700"
                          title="Archivar"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {currentParishName && (
        <div className="border-t border-slate-100 px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400">
          Bandeja receptora · {currentParishName}
        </div>
      )}
    </div>
  );
};

export default TablaAvisos;
