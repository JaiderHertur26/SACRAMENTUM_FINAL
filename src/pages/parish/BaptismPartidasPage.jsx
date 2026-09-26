import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { fetchBaptismsFromSource, getParishPrintProfile } from '@/services/sacramentsService';
import { listMarginalNotesForRecord } from '@/services/marginalNotesV2Service';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { 
    Search, Info, 
    CheckCircle as CircleCheckBig, XCircle, Eye, AlertOctagon, 
    BookOpen, Loader2, User, Users, MapPin, PenTool, Scroll, ShieldCheck 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ViewBaptismPartidaModal from '@/components/modals/ViewBaptismPartidaModal';

const formatCivilDate = (value) => {
    if (!value) return '---';
    const raw = String(value).slice(0, 10);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
};

const getStatusMeta = (value) => {
    const status = String(value || '').trim().toLowerCase();
    if (['anulada', 'annulled'].includes(status)) return { label: 'Anulada', inactive: true };
    if (['reversed', 'revertida'].includes(status)) return { label: 'Revertida', inactive: true };
    if (['replaced', 'deleted'].includes(status)) return { label: 'No vigente', inactive: true };
    return { label: 'Vigente', inactive: false };
};

// --- COMPONENTE: PANEL DE DETALLES EXTENDIDO (INSPECCIÓN PARROQUIAL) ---
const InfoBox = ({ data, marginalNotes = [] }) => {
    if (!data) return null;
    
    const isReplacement = data.isSupplementary || data.tipoIdentidad === 'id_creada_reposicion';
    const isNarrative = data.historicalEntryMode === 'narrative' && String(data.literalTranscription || '').trim().length > 0;
    const visibleMarginalNotes = marginalNotes
        .map(note => String(note?.content || '').trim())
        .filter(Boolean);

    const getResolvedDaFe = () => {
        const rawDaFe = String(data.daFe || data.dafe || data.da_fe || '').trim();
        if (!rawDaFe || !isNaN(Number(rawDaFe))) return '---';
        const limpio = rawDaFe.replace(/^(PBRO\.?\s*|PADRE\s*|SACERDOTE\s*)/i, '').trim();
        return limpio ? `PBRO. ${limpio}` : '---';
    };

    // Limpieza de Ministro
    const getResolvedMinistro = () => {
        let min = data.ministro;
        if (!min || !isNaN(Number(String(min).trim()))) return '---';
        min = String(min).replace(/^(PBRO\.?\s*|PADRE\s*|SACERDOTE\s*)/i, '').trim();
        return `PBRO. ${min}`;
    };

    return (
        <div className="mt-8 border border-slate-200/80 rounded-[2.5rem] overflow-hidden shadow-2xl bg-white animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-900 px-8 py-5 flex justify-between items-center">
                <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3">
                   <Info className="w-4 h-4 text-[#D4AF37]" /> Inspección de Registro Parroquial
                </h3>
                <div className="flex items-center gap-2">
                    {isNarrative && (
                        <span className="bg-amber-100 text-amber-900 text-[9px] font-black uppercase px-3 py-1 rounded-full border border-amber-200 shadow-sm">
                            Transcripción literal
                        </span>
                    )}
                    {data.isDeceased && (
                        <span className="bg-slate-700 text-white text-[9px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                            <XCircle className="w-3 h-3"/> Fallecido
                        </span>
                    )}
                    {isReplacement && (
                        <span className="bg-amber-400 text-slate-900 text-[9px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                            <AlertOctagon className="w-3 h-3"/> Acta por Decreto
                        </span>
                    )}
                </div>
            </div>

            <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                    <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Localización Física</span>
                        <span className="text-base font-black text-[#4B7BA7] font-mono bg-white px-4 py-2 rounded-xl border border-blue-100 inline-block shadow-sm">
                            L:{data.Libro} • F:{data.folio} • N:{data.numero}
                        </span>
                    </div>
                    <div className="md:col-span-2 space-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                            {isNarrative ? 'Referencia de búsqueda' : 'Bautizado (Apellidos y Nombres)'}
                        </span>
                        <span className="text-xl font-black text-slate-900 uppercase tracking-tight block">
                            {isNarrative ? (data.referenceName || 'Asiento histórico narrativo') : `${data.apellidos || ''} ${data.nombres || ''}`.trim()}
                        </span>
                    </div>
                </div>

                {!isNarrative ? (
                  <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <DetailItem icon={MapPin} label="Lugar Nacimiento" value={data.lugarNacimiento} />
                    <DetailItem icon={User} label="Fecha Nacimiento" value={formatCivilDate(data.fechaNacimiento)} />
                    <DetailItem icon={MapPin} label="Lugar Bautismo" value={data.lugarBautismo} />
                    <DetailItem icon={User} label="Fecha Bautismo" value={formatCivilDate(data.fechaSacramento)} />
                </div>

                {data.isDeceased && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-[2rem] border border-slate-300 bg-slate-100 p-6">
                        <DetailItem icon={XCircle} label="Fecha de defunción" value={formatCivilDate(data.fechaDefuncion)} />
                        <DetailItem icon={MapPin} label="Lugar de defunción" value={data.lugarDefuncion} />
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50/70 p-6 rounded-[2rem] border border-slate-200 space-y-4">
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-[#4B7BA7]" /> Línea Paterna
                        </h4>
                        <DetailItem label="Padre" value={data.nombrePadre} />
                        <DetailItem label="Abuelos Paternos" value={data.abuelosPaternos} isItalic />
                    </div>
                    <div className="bg-slate-50/70 p-6 rounded-[2rem] border border-slate-200 space-y-4">
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-[#4B7BA7]" /> Línea Materna
                        </h4>
                        <DetailItem label="Madre" value={data.nombreMadre} />
                        <DetailItem label="Abuelos Maternos" value={data.abuelosMaternos} isItalic />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                    <DetailItem icon={Users} label="Padrinos" value={data.padrinos} />
                    <DetailItem icon={PenTool} label="Ministro Celebrante" value={getResolvedMinistro()} />
                    <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-[#D4AF37]" /> Párroco que Da Fe
                        </span>
                        <span className="text-xs font-black text-[#4B7BA7] uppercase bg-white px-3 py-1.5 rounded-xl border border-blue-100 inline-block shadow-sm">
                            {getResolvedDaFe()}
                        </span>
                    </div>
                </div>

                  </>
                ) : (
                  <div className="rounded-[2rem] border border-amber-200 bg-[#fffdf8] p-7 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-700">Transcripción literal del asiento original</p>
                    {data.referenceName ? <p className="mt-2 text-xs font-black uppercase text-slate-500">Referencia: {data.referenceName}</p> : null}
                    <p className="mt-5 whitespace-pre-wrap font-serif text-[15px] leading-7 text-slate-800">{data.literalTranscription}</p>
                  </div>
                )}

                <div className={`p-6 rounded-[2rem] border shadow-sm ${visibleMarginalNotes.length ? 'bg-amber-50/30 border-amber-200/60' : 'bg-slate-50/70 border-slate-200/70'}`}>
                    <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-2 ${visibleMarginalNotes.length ? 'text-amber-800' : 'text-slate-600'}`}>
                        <BookOpen className={`w-3.5 h-3.5 ${visibleMarginalNotes.length ? 'text-amber-600' : 'text-slate-400'}`} /> Notas Marginales Vigentes
                    </h4>
                    {visibleMarginalNotes.length ? (
                        <div className="space-y-2">
                            {visibleMarginalNotes.map((note, index) => (
                                <p key={`${data.id || 'partida'}-note-${index}`} className="text-xs font-bold text-slate-700 leading-relaxed font-mono uppercase italic">
                                    “{note}”
                                </p>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs font-black text-slate-500 uppercase tracking-wide">
                            Ninguna nota vigente registrada
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

const DetailItem = ({ icon: Icon, label, value, isItalic = false }) => (
    <div className="space-y-1 text-left">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            {Icon && <Icon className="w-3 h-3 text-slate-400" />} {label}
        </span>
        <span className={`text-xs font-bold text-slate-800 uppercase block ${isItalic ? 'italic font-medium text-slate-500' : ''}`}>
            {value || '---'}
        </span>
    </div>
);

const BaptismPartidasPage = () => {
  const { user } = useAuth();
  const { getMisDatosList } = useAppData();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState([]);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 50;
  
  const [selectedPartida, setSelectedPartida] = useState(null); 
  const [selectedMarginalNotes, setSelectedMarginalNotes] = useState([]);
  const [parishPrintData, setParishPrintData] = useState({});
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const parishId = user?.parish_id || user?.parishId || null;
  const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA';

  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  useEffect(() => {
      let active = true;
      const loadPrintProfile = async () => {
          if (!parishId) return;
          const misDatos = getMisDatosList(parishId);
          const legacyPrintInfo = misDatos?.[0] || {};
          try {
              const cloudPrintInfo = await getParishPrintProfile(parishId);
              if (active) setParishPrintData({ ...legacyPrintInfo, ...(cloudPrintInfo || {}) });
          } catch (profileError) {
              console.warn('No fue posible cargar el perfil institucional desde Supabase:', profileError);
              if (active && misDatos?.length > 0) setParishPrintData(legacyPrintInfo);
          }
      };
      loadPrintProfile();
      return () => { active = false; };
  }, [parishId, getMisDatosList]);

  useEffect(() => {
      let active = true;
      if (!selectedPartida?.id || !parishId) {
          setSelectedMarginalNotes([]);
          return () => { active = false; };
      }

      listMarginalNotesForRecord({
          parishId,
          sacramentType: 'bautismo',
          sacramentId: selectedPartida.id,
          legacyInlineNote: selectedPartida.notaMarginal || selectedPartida.nota_marginal || ''
      })
          .then(notes => { if (active) setSelectedMarginalNotes(notes || []); })
          .catch(error => {
              console.warn('No fue posible cargar notas marginales vigentes en Partidas:', error);
              if (active) setSelectedMarginalNotes([]);
          });

      return () => { active = false; };
  }, [selectedPartida, parishId]);

  const fetchRecords = useCallback(async () => {
      if (!parishId) return;
      setIsLoading(true);

      try {
          const allData = await fetchBaptismsFromSource(parishId);
          setArchiveTotal((allData || []).length);

          let filtered = allData || [];
          if (searchTerm.trim()) {
              const term = searchTerm.trim().toUpperCase();
              const archiveMatch = term.match(/^\s*(\d+)\s*[:\/-]\s*(\d+)\s*[:\/-]\s*(\d+)\s*$/);
              const normalizedArchiveTerm = archiveMatch
                  ? `${archiveMatch[1].padStart(4, '0')}:${archiveMatch[2].padStart(4, '0')}:${archiveMatch[3].padStart(4, '0')}`
                  : null;

              filtered = filtered.filter(r => {
                  const archiveKey = `${r.Libro}:${r.folio}:${r.numero}`;
                  return (r.nombres && r.nombres.includes(term)) ||
                      (r.apellidos && r.apellidos.includes(term)) ||
                      (r.nombrePadre && r.nombrePadre.includes(term)) ||
                      (r.nombreMadre && r.nombreMadre.includes(term)) ||
                      (r.numeroRegistro && String(r.numeroRegistro).includes(term)) ||
                      (r.referenceName && String(r.referenceName).toUpperCase().includes(term)) ||
                      (r.literalTranscription && String(r.literalTranscription).toUpperCase().includes(term)) ||
                      archiveKey.includes(term) ||
                      (normalizedArchiveTerm && archiveKey === normalizedArchiveTerm);
              });
          }

          setTotalRecords(filtered.length);
          const from = (currentPage - 1) * recordsPerPage;
          setRecords(filtered.slice(from, from + recordsPerPage));

          setSelectedPartida(prev => {
              if (!prev) return prev;
              return filtered.find(r => r.id === prev.id) || prev;
          });
      } catch (err) {
          console.error("Error al consultar partidas:", err);
      } finally {
          setIsLoading(false);
      }
  }, [parishId, searchTerm, currentPage]);

  useEffect(() => {
      fetchRecords();
  }, [fetchRecords]);

  const columns = [
    { 
        header: 'Archivo',
        render: (r) => <span className="font-black text-[12px] font-black text-[#4B7BA7] bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-100 uppercase text-center min-w-[110px] inline-block shadow-sm">L:{r.Libro} F:{r.folio} N:{r.numero}</span>
    },
    { header: 'Apellidos', render: (r) => r.historicalEntryMode === 'narrative' ? <span className="font-black text-amber-700 uppercase text-[10px]">Transcripción literal</span> : <span className="font-black text-slate-900 uppercase text-xs">{r.apellidos}</span> },
    { header: 'Nombres', render: (r) => <span className="font-black text-slate-900 uppercase text-xs">{r.historicalEntryMode === 'narrative' ? (r.referenceName || 'Asiento histórico narrativo') : r.nombres}</span> },
    { header: 'Fecha', render: (r) => <span className="font-black text-slate-900 uppercase text-xs">{r.historicalEntryMode === 'narrative' ? '—' : formatCivilDate(r.fechaSacramento)}</span> },
    {
        header: 'Origen',
        render: (r) => {
            const sourceLabel = r.source === 'legacy_import'
                ? 'Migración histórica'
                : r.source === 'historical_book_digitization'
                    ? 'Digitalizada'
                    : 'Ordinaria';
            const sourceClass = r.source === 'legacy_import'
                ? 'bg-violet-50 text-violet-700 border-violet-100'
                : r.source === 'historical_book_digitization'
                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                    : 'bg-slate-50 text-slate-500 border-slate-100';
            return <span className={'inline-flex rounded-full border px-3 py-1 text-[8px] font-black uppercase tracking-wide ' + sourceClass}>{sourceLabel}</span>;
        }
    },
    {
        header: 'Estado',
        render: (r) => {
            const meta = getStatusMeta(r.status);
            return (
                <div className="flex flex-col items-start gap-1.5">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-tighter ${meta.inactive ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                        {meta.inactive ? <XCircle className="w-3 h-3"/> : <CircleCheckBig className="w-3 h-3"/>}
                        {meta.label}
                    </span>
                    {r.isDeceased && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-tighter bg-slate-800 text-white border-slate-700">
                            <XCircle className="w-3 h-3"/> Fallecido
                        </span>
                    )}
                </div>
            );
        }
    }
  ];

  return (
    <DashboardLayout entityName={nombreParroquia}>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-20 pt-2">
          <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase font-serif">Partidas de Bautismo</h1>
                <p className="text-[#4B7BA7] text-[10px] font-black uppercase tracking-[0.3em] mt-2 ml-1">{nombreParroquia} • Archivo Parroquial Permanente</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
                {searchTerm.trim() && (
                    <div className="bg-blue-50 text-[#4B7BA7] border border-blue-100 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                        Coincidencias: {totalRecords}
                    </div>
                )}
                <div className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                    Total en Archivo: {archiveTotal}
                </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex gap-4 items-center">
             <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                <input 
                    type="text" 
                    placeholder="LOCALIZAR POR NOMBRE, REFERENCIA, TEXTO LITERAL O LIBRO:FOLIO:NÚMERO..."
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-[#4B7BA7]/10 outline-none text-xs font-black uppercase placeholder:text-slate-300 transition-all" 
                    value={searchTerm} 
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                />
             </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border border-slate-100">
                <Loader2 className="w-12 h-12 text-[#4B7BA7] animate-spin mb-4" />
                <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Consultando Libro de Partidas...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-16 text-center shadow-sm">
                <Scroll className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-bold uppercase text-slate-700">{searchTerm.trim() ? 'Sin coincidencias' : 'No hay actas registradas'}</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchTerm.trim()
                        ? `No se encontraron partidas para “${searchTerm.trim()}”. El archivo conserva ${archiveTotal} registro(s).`
                        : 'Las actas aparecerán aquí una vez que hayan sido asentadas oficialmente o digitalizadas desde el libro físico.'}
                </p>
                {!searchTerm.trim() && (
                    <Button variant="outline" className="mt-6 rounded-xl font-black uppercase text-[10px]" onClick={() => navigate('/parroquia/bautismo/sentar-registros')}>
                        Ir a Sentar Registros
                    </Button>
                )}
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-slate-100 overflow-hidden">
                <Table 
                    columns={columns} 
                    data={records} 
                    onRowClick={(row) => setSelectedPartida(prev => prev?.id === row.id ? null : row)}
                    rowClassName={(row) => selectedPartida?.id === row.id ? '!bg-blue-50/80 ring-1 ring-inset ring-[#4B7BA7]/25' : ''}
                    actions={[
                        { label: <Eye className="w-4 h-4" />, onClick: (r, e) => { e.stopPropagation(); setSelectedPartida(r); setIsViewModalOpen(true); }, className: "text-[#D4AF37] hover:bg-amber-50", title: "Ver partida" }
                    ]}
                />
                <div className="bg-slate-50/50 border-t border-slate-100 px-10 py-5 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages || 1}</span>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-xl font-black uppercase text-[10px]">Anterior</Button>
                        <div className="h-4 w-px bg-slate-200" />
                        <Button variant="ghost" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="rounded-xl font-black uppercase text-[10px]">Siguiente</Button>
                    </div>
                </div>
            </div>
          )}

          <InfoBox data={selectedPartida} marginalNotes={selectedMarginalNotes} />
          
          {isViewModalOpen && (
              <ViewBaptismPartidaModal 
                  isOpen={isViewModalOpen} 
                  onClose={() => setIsViewModalOpen(false)} 
                  partida={selectedPartida} 
                  auxiliaryData={parishPrintData} 
              />
          )}
      </div>
    </DashboardLayout>
  );
};

export default BaptismPartidasPage;