import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import Table from '@/components/ui/Table';
import { Search, ArrowUpDown, Info, CheckCircle, XCircle, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import MarriageReadingSummaryPanel from '@/components/MarriageReadingSummaryPanel';
import ViewMarriagePartidaModal from '@/components/modals/ViewMarriagePartidaModal';
import { listMarriagesCloud } from '@/services/marriagesCloudService';
import { getParishPrintProfile } from '@/services/sacramentsService';

const InfoBox = ({ data }) => {
    if (!data) return null;
    const isNarrative = data.historicalEntryMode === 'narrative' && String(data.literalTranscription || '').trim().length > 0;
    return (
        <div className="mt-8 border border-blue-200 rounded-lg overflow-hidden shadow-sm bg-white animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-[#4B7BA7] to-[#2a4e70] px-6 py-3 border-b border-blue-800 flex justify-between items-center">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                   <Info className="w-5 h-5 text-blue-200" />
                   Detalles del Registro Seleccionado
                </h3>
                {isNarrative && (
                    <span className="bg-amber-100 text-amber-900 text-[9px] font-black uppercase px-3 py-1 rounded-full border border-amber-200 shadow-sm">
                        Transcripción literal
                    </span>
                )}
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-y-6 gap-x-8">
                 <div className="space-y-1 min-w-0">
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Libro / Folio / Número</span>
                     <span className="text-base font-bold text-slate-900 bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-block font-mono">
                         {data.book_number} / {data.page_number} / {data.entry_number}
                     </span>
                 </div>
                 {!isNarrative ? (
                   <>
                 <div className="space-y-1 min-w-0">
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Fecha Matrimonio</span>
                     <span className="text-base font-medium text-slate-800">{data.sacramentDate || '-'}</span>
                 </div>
                 <div className="space-y-1 min-w-0">
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Lugar</span>
                     <p className="text-sm font-medium text-slate-800 whitespace-normal break-words leading-snug" title={data.place}>
                         {data.place || '-'}
                     </p>
                 </div>
                 <div className="space-y-1 min-w-0">
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Ministro</span>
                     <p className="text-sm font-medium text-slate-800 whitespace-normal break-words leading-snug" title={data.minister}>
                         {data.minister || '-'}
                     </p>
                 </div>
                 <div className="border-t border-slate-100 col-span-full my-1"></div>
                 <div className="col-span-2 space-y-1">
                     <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">Novio</span>
                     <span className="text-lg font-bold text-slate-900 uppercase">{data.groomName} {data.groomSurname}</span>
                 </div>
                 <div className="col-span-2 space-y-1">
                     <span className="text-xs font-bold text-[#4B7BA7] uppercase tracking-wider block">Novia</span>
                     <span className="text-lg font-bold text-slate-900 uppercase">{data.brideName} {data.brideSurname}</span>
                 </div>
                 <div className="border-t border-slate-100 col-span-full my-1"></div>
                 <div className="col-span-2 space-y-1">
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Padres del Novio</span>
                     <span className="text-base font-medium text-slate-800 uppercase">{data.groomFather} y {data.groomMother}</span>
                 </div>
                 <div className="col-span-2 space-y-1">
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Padres de la Novia</span>
                     <span className="text-base font-medium text-slate-800 uppercase">{data.brideFather} y {data.brideMother}</span>
                 </div>
                   </>
                 ) : (
                   <div className="col-span-full rounded-[1.5rem] border border-amber-200 bg-[#fffdf8] p-6 shadow-sm">
                     <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-700">Transcripción literal del asiento original</p>
                     {data.referenceName ? <p className="mt-2 text-xs font-black uppercase text-slate-500">Referencia: {data.referenceName}</p> : null}
                     <p className="mt-5 whitespace-pre-wrap font-serif text-[15px] leading-7 text-slate-800">{data.literalTranscription}</p>
                   </div>
                 )}

            </div>
        </div>
    );
};

const MatrimonioPartidasPage = () => {
  const { user } = useAuth();
  const { getMisDatosList } = useAppData();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for data handling
  const [selectedPartida, setSelectedPartida] = useState(null); // Used for InfoBox
  const [selectedRecord, setSelectedRecord] = useState(null); // Used for Modal
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  const [sortConfig, setSortConfig] = useState({ key: 'entry_number', direction: 'desc' });
  const [parishPrintData, setParishPrintData] = useState({});
  const [isReadingPanelOpen, setIsReadingPanelOpen] = useState(false);
  const [selectedReadingRecord, setSelectedReadingRecord] = useState(null);

  useEffect(() => { loadData(); loadParishData(); }, [user]);


  const loadParishData = async () => {
    if (!user?.parishId) return;
    let legacyProfile = {};
    try {
      const misDatos = getMisDatosList(user.parishId);
      legacyProfile = (misDatos && misDatos.length > 0) ? (misDatos[0]?.['0'] || misDatos[0]) : {};
    } catch (err) {
      console.warn("No fue posible leer el perfil local de Matrimonio:", err);
    }

    try {
      const cloudProfile = await getParishPrintProfile(user.parishId);
      setParishPrintData({ ...legacyProfile, ...(cloudProfile || {}) });
    } catch (err) {
      console.warn("No fue posible cargar el perfil institucional de Matrimonio:", err);
      setParishPrintData(legacyProfile);
    }
  };

  const loadData = async () => {
    if (!user?.parishId) return;
    setIsLoading(true);
    try { setRecords(await listMarriagesCloud(user.parishId)); }
    catch (error) { console.error("Error loading marriages:", error); toast({ title: 'Error', description: error?.message || 'No se pudieron cargar los matrimonios.', variant: 'destructive' }); }
    finally { setIsLoading(false); }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedRecords = [...records].sort((a, b) => {
      let aValue = a[sortConfig.key], bValue = b[sortConfig.key];
      if (sortConfig.key === 'entry_number') {
         aValue = (parseInt(a.book_number || 0) * 1000000) + (parseInt(a.page_number || 0) * 1000) + parseInt(a.entry_number || 0);
         bValue = (parseInt(b.book_number || 0) * 1000000) + (parseInt(b.page_number || 0) * 1000) + parseInt(b.entry_number || 0);
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
  });

  const filteredRecords = sortedRecords.filter(r => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    const groom = `${r.groomName || ''} ${r.groomSurname || ''}`.toLowerCase();
    const bride = `${r.brideName || ''} ${r.brideSurname || ''}`.toLowerCase();
    const archive = `${r.book_number || ''}:${r.page_number || ''}:${r.entry_number || ''}`.toLowerCase();
    const reference = String(r.referenceName || '').toLowerCase();
    const transcription = String(r.literalTranscription || '').toLowerCase();
    return groom.includes(term) || bride.includes(term) || archive.includes(term) || reference.includes(term) || transcription.includes(term);
  });
const handleViewClick = (row, e) => { 
      e?.stopPropagation(); 
      setSelectedRecord(row); 
      setIsViewModalOpen(true); 
  };

  const columns = [
    { 
        header: <div onClick={() => handleSort('entry_number')} className="cursor-pointer">Número <ArrowUpDown className="inline w-3 h-3"/></div>, 
        render: (row) => (
             <div className="flex flex-col items-start gap-1">
                 <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-700">L:{row.book_number} F:{row.page_number} N:{row.entry_number}</span>
                 <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                   {row.historicalEntryMode === 'narrative' ? 'TRANSCRIPCIÓN LITERAL' : String(row.bookType || 'ordinario').toUpperCase()}
                 </span>
                 {row.newBaptismIdRepo && <span className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded border border-amber-200">REPOSICIÓN</span>}
             </div>
        )
    },
    { header: 'Novio', render: (row) => <span className="font-semibold text-blue-900 uppercase">{row.historicalEntryMode === 'narrative' ? (row.referenceName || 'Asiento histórico narrativo') : `${row.groomName || ''} ${row.groomSurname || ''}`.trim()}</span> },
    { header: 'Novia', render: (row) => <span className="font-semibold text-slate-900 uppercase">{row.historicalEntryMode === 'narrative' ? '—' : `${row.brideName || ''} ${row.brideSurname || ''}`.trim()}</span> },
    { header: 'Fecha', render: (row) => <span className="text-slate-600 text-sm">{row.historicalEntryMode === 'narrative' ? '—' : row.sacramentDate}</span> },
  ];

  if (isLoading) return <DashboardLayout entityName={user?.parishName || "Parroquia"}><div className="flex justify-center items-center h-64"><p className="text-slate-500">Cargando partidas...</p></div></DashboardLayout>;

  return (
    <DashboardLayout entityName={user?.parishName || "Parroquia"}>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-20 pt-2">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase font-serif">Partidas de Matrimonio</h1>
          <p className="text-[#4B7BA7] text-[10px] font-black uppercase tracking-[0.3em] mt-2 ml-1">{user?.parishName || 'Parroquia'} • Archivo Parroquial Permanente</p>
        </div>
        <div className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Total en Archivo: {filteredRecords.length}</div>
      </div>
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex gap-4 items-center">
         <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" /><input type="text" placeholder="LOCALIZAR POR CONTRAYENTES, REFERENCIA, TEXTO LITERAL O LIBRO:FOLIO:NÚMERO..." className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-[#4B7BA7]/10 outline-none text-xs font-black uppercase placeholder:text-slate-300 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
      </div>
      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-slate-100 overflow-hidden">
            <Table columns={columns} data={filteredRecords} onRowClick={(row) => setSelectedPartida(row)} actions={[
                    { label: <Eye className="w-4 h-4" />, type: 'view', onClick: handleViewClick, className: "text-[#D4AF37] hover:bg-amber-50 p-2 rounded-full", title: "Visualizar Partida" },
                    { 
                        label: (row) => {
                            const isAnnulled = ['anulada','annulled','nullified','nulo'].includes(String(row.status || row.estado || '').toLowerCase()) || row.isAnnulled;
                            return isAnnulled 
                                ? <XCircle className="w-4 h-4" />
                                : <CheckCircle className="w-4 h-4" />;
                        },
                        type: 'verify-status', 
                        className: (row) => {
                            const isAnnulled = ['anulada','annulled','nullified','nulo'].includes(String(row.status || row.estado || '').toLowerCase()) || row.isAnnulled;
                            return `p-2 rounded-full h-9 w-9 flex items-center justify-center cursor-default ${
                                isAnnulled ? 'text-red-500' : 'text-green-500'
                            }`;
                        }, 
                        title: (row) => {
                            const isAnnulled = ['anulada','annulled','nullified','nulo'].includes(String(row.status || row.estado || '').toLowerCase()) || row.isAnnulled;
                            return isAnnulled ? "Partida Anulada" : "Partida Correcta";
                        },
                        disabled: true
                    },
            ]}/>
      </div>
      <InfoBox data={selectedPartida} />
      
      <ViewMarriagePartidaModal
          isOpen={isViewModalOpen}
          onClose={() => { setIsViewModalOpen(false); setSelectedRecord(null); }}
          partida={selectedRecord}
          auxiliaryData={parishPrintData}
      />

      <MarriageReadingSummaryPanel isOpen={isReadingPanelOpen} onClose={() => { setIsReadingPanelOpen(false); setSelectedReadingRecord(null); }} data={selectedReadingRecord} />
      </div>
    </DashboardLayout>
  );
};

export default MatrimonioPartidasPage;