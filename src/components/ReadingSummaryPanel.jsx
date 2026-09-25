import React from 'react';
import { X, CheckCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ReadingSummaryPanel = ({ isOpen, onClose, data, sacramentType }) => {
  if (!isOpen || !data) return null;

  // Helper to safely get data
  const getVal = (key, fallback = '---') => data[key] || fallback;
  
  // Format Date Helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '---';
    // If it's already formatted (contains /), return it. If YYYY-MM-DD, format it.
    if (dateStr.includes('/')) return dateStr;
    try {
        const [y, m, d] = dateStr.split('T')[0].split('-');
        return `${d}/${m}/${y}`;
    } catch (e) {
        return dateStr;
    }
  };

  const Label = ({ children }) => (
    <span className="block text-[10px] font-bold text-[#4B7BA7] uppercase tracking-wider mb-0.5">
      {children}
    </span>
  );

  const Value = ({ children, className = "" }) => (
    <span className={`block text-sm font-bold text-black leading-tight ${className}`}>
      {children || '---'}
    </span>
  );

  const Section = ({ children, className = "" }) => (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pb-4 border-b border-slate-100 last:border-0 last:mb-0 last:pb-0 ${className}`}>
      {children}
    </div>
  );

  // Field renderer based on sacrament type
  const renderFields = () => {
    switch (sacramentType) {
      case 'baptism':
        return (
          <>
            <Section className="md:grid-cols-3">
               <div><Label>Libro</Label><Value>{getVal('book_number')}</Value></div>
               <div><Label>Folio</Label><Value>{getVal('page_number')}</Value></div>
               <div><Label>Número</Label><Value>{getVal('entry_number')}</Value></div>
            </Section>
            
            <Section>
               <div><Label>Fecha Bautismo</Label><Value>{formatDate(getVal('sacramentDate'))}</Value></div>
               <div><Label>Ministro</Label><Value>{getVal('minister')}</Value></div>
               {getVal('registryOffice') && (
                   <div className="col-span-2 mt-2"><Label>Oficina Registro Civil</Label><Value className="text-slate-600 font-medium text-xs">{getVal('registryOffice')}</Value></div>
               )}
            </Section>

            <Section>
               <div><Label>Apellidos</Label><Value>{getVal('lastName')}</Value></div>
               <div><Label>Nombres</Label><Value>{getVal('firstName')}</Value></div>
               <div><Label>Sexo</Label><Value>{getVal('sex')}</Value></div>
               <div><Label>Fecha Nacimiento</Label><Value>{formatDate(getVal('birthDate'))}</Value></div>
               <div className="col-span-2"><Label>Lugar Nacimiento</Label><Value>{getVal('lugarNacimientoDetalle') || getVal('birthPlace')}</Value></div>
            </Section>

            <Section>
               <div><Label>Padre</Label><Value>{getVal('fatherName')}</Value></div>
               <div><Label>Madre</Label><Value>{getVal('motherName')}</Value></div>
               <div className="col-span-2"><Label>Lugar Bautismo</Label><Value>{getVal('lugarBautismoDetalle') || getVal('sacramentPlace')}</Value></div>
            </Section>
          </>
        );
      
      case 'confirmation':
        return (
          <>
            <Section className="md:grid-cols-3">
               <div><Label>Libro</Label><Value>{getVal('book_number')}</Value></div>
               <div><Label>Folio</Label><Value>{getVal('page_number')}</Value></div>
               <div><Label>Número</Label><Value>{getVal('entry_number')}</Value></div>
            </Section>

            <Section>
               <div><Label>Fecha Confirmación</Label><Value>{formatDate(getVal('sacramentDate'))}</Value></div>
               <div><Label>Ministro</Label><Value>{getVal('minister')}</Value></div>
            </Section>

            <Section>
               <div><Label>Apellidos</Label><Value>{getVal('lastName')}</Value></div>
               <div><Label>Nombres</Label><Value>{getVal('firstName')}</Value></div>
               <div><Label>Sexo</Label><Value>{getVal('sex')}</Value></div>
               <div><Label>Fecha Nacimiento</Label><Value>{formatDate(getVal('birthDate'))}</Value></div>
               <div className="col-span-2"><Label>Lugar Nacimiento</Label><Value>{getVal('lugarNacimientoDetalle') || getVal('birthPlace')}</Value></div>
            </Section>

            <Section>
               <div className="col-span-2"><Label>Padrinos</Label><Value>{getVal('godparents')}</Value></div>
               <div className="col-span-2"><Label>Lugar Confirmación</Label><Value>{getVal('lugarConfirmacionDetalle') || getVal('sacramentPlace')}</Value></div>
            </Section>
          </>
        );

      case 'marriage':
        return (
            <>
            <Section className="md:grid-cols-3">
               <div><Label>Libro</Label><Value>{getVal('book_number')}</Value></div>
               <div><Label>Folio</Label><Value>{getVal('page_number')}</Value></div>
               <div><Label>Número</Label><Value>{getVal('entry_number')}</Value></div>
            </Section>

            <Section>
               <div><Label>Fecha Matrimonio</Label><Value>{formatDate(getVal('sacramentDate'))}</Value></div>
               <div><Label>Ministro</Label><Value>{getVal('minister')}</Value></div>
            </Section>

            <div className="mb-4 pb-4 border-b border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <Label>Novio</Label>
                        <Value className="text-blue-900 mb-2">{getVal('groomName')} {getVal('groomSurname')}</Value>
                        <Label>Padres</Label>
                        <Value className="text-xs font-normal text-slate-700">{getVal('groomFather')} y {getVal('groomMother')}</Value>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <Label>Novia</Label>
                        <Value className="text-blue-900 mb-2">{getVal('brideName')} {getVal('brideSurname')}</Value>
                        <Label>Padres</Label>
                        <Value className="text-xs font-normal text-slate-700">{getVal('brideFather')} y {getVal('brideMother')}</Value>
                    </div>
                </div>
            </div>

            <Section>
               <div className="col-span-2"><Label>Lugar Matrimonio</Label><Value>{getVal('place')}</Value></div>
               {getVal('registryOffice') && <div className="col-span-2"><Label>Oficina Registro</Label><Value>{getVal('registryOffice')}</Value></div>}
            </Section>
            </>
        );

      default:
        return <p className="text-slate-500 italic">Información no disponible.</p>;
    }
  };

  // Logic to determine if the "CORRECTA" status should be shown
  const isCorrecta = data && data.isAnnulled === false && data.status !== 'anulada';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          // Ensure main container has relative positioning and allows overflow for the badge
          className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-visible border border-slate-200 flex flex-col max-h-[90vh] relative" 
        >
          {/* Header */}
          <div className="bg-[#4B7BA7] px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0">
             <div className="flex items-center gap-2 text-white">
                <Info className="w-5 h-5 opacity-90" />
                <h3 className="font-bold text-lg tracking-wide">Resumen del Registro (Lectura)</h3>
             </div>
             <button 
                onClick={onClose}
                className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1 transition-colors"
             >
                <X className="w-5 h-5" />
             </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-grow">
             {renderFields()}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 flex-shrink-0 min-h-[60px]">
             {/* Footer content is minimal to allow space for status */}
          </div>

          {/* Conditional status text, absolutely positioned */}
          {data && (
            <div className="absolute bottom-4 right-4 z-20">
              {isCorrecta ? (
                <p className="text-green-600 font-bold text-lg">CORRECTA</p>
              ) : (
                <p className="text-red-600 font-bold text-lg">ANULADA</p>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ReadingSummaryPanel;