import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import Table from '@/components/ui/Table';
import { Search, Printer, FileText, Filter, BookMarked } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Modal } from '@/components/ui/Modal';
import MarriageIndexPrintTemplate from '@/components/MarriageIndexPrintTemplate';
import { Helmet } from 'react-helmet';
import { listMarriagesCloud } from '@/services/marriagesCloudService';

const MarriageIndexPage = () => {
  const { user } = useAuth();
  const { getMisDatosList } = useAppData();
  const { toast } = useToast();
  
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [availableBooks, setAvailableBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState('');
  const [printData, setPrintData] = useState([]);
  const [parishInfo, setParishInfo] = useState({});
  const [currentPrintFilter, setCurrentPrintFilter] = useState(null);

  useEffect(() => {
    if (user?.parishId) {
      loadData();
      loadParishInfo();
    }
  }, [user]);

  useEffect(() => {
    filterAndSortRecords();
  }, [searchTerm, records]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allRecords = await listMarriagesCloud(user.parishId);
      
      const sorted = [...allRecords].sort((a, b) => {
        const bookA = parseInt(a.book_number || 0);
        const bookB = parseInt(b.book_number || 0);
        if (bookA !== bookB) return bookA - bookB;

        const pageA = parseInt(a.page_number || 0);
        const pageB = parseInt(b.page_number || 0);
        if (pageA !== pageB) return pageA - pageB;

        const entryA = parseInt(a.entry_number || 0);
        const entryB = parseInt(b.entry_number || 0);
        if (entryA !== entryB) return entryA - entryB;

        return new Date(a.sacramentDate) - new Date(b.sacramentDate);
      });

      setRecords(sorted);
      const books = [...new Set(sorted.map(r => r.book_number).filter(Boolean))].sort((a, b) => parseInt(a) - parseInt(b));
      setAvailableBooks(books);

    } catch (error) {
      console.error("Error loading marriages:", error);
      toast({ title: "Error", description: "No se pudieron cargar los registros.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadParishInfo = () => {
    try {
        const misDatos = getMisDatosList(user.parishId);
        // Extract first record or empty
        const data = (misDatos && misDatos.length > 0) ? misDatos[0] : {};
        
        // Build specific object structure requested: { nombre, ciudad, diocesis }
        // extracting specifically "Nombre" (capitalized) from data as requested
        setParishInfo({
            nombre: data.Nombre || user.parishName || 'PARROQUIA',
            ciudad: data.Ciudad || data.ciudad || 'CIUDAD',
            diocesis: data.Diócesis || data.diocesis || user.dioceseName || 'DIÓCESIS'
        });
    } catch (err) {
        console.error("Error loading parish info:", err);
        setParishInfo({
            nombre: user.parishName || 'PARROQUIA',
            ciudad: 'CIUDAD',
            diocesis: user.dioceseName || 'DIÓCESIS'
        });
    }
  };

  const filterAndSortRecords = () => {
    let filtered = records;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        (r.groomName || '').toLowerCase().includes(term) ||
        (r.groomSurname || '').toLowerCase().includes(term) ||
        (r.brideName || '').toLowerCase().includes(term) ||
        (r.brideSurname || '').toLowerCase().includes(term) ||
        String(r.book_number || '').includes(term)
      );
    }
    setFilteredRecords(filtered);
  };

  const handlePrint = (bookNumber = null) => {
    let dataToPrint = records;
    if (bookNumber) {
        dataToPrint = records.filter(r => String(r.book_number) === String(bookNumber));
        setCurrentPrintFilter(bookNumber);
    } else {
        setCurrentPrintFilter(null);
    }
    setPrintData(dataToPrint);

    setTimeout(() => {
         const printContent = document.getElementById('marriage-index-print');
         if (!printContent) return;
         
         const printWindow = window.open('', '', 'height=600,width=800');
         printWindow.document.write('<html><head><title>Índice de Matrimonios · SACRAMENTUM</title>');
         printWindow.document.write('<style>@page { size: letter; margin: 0.5in; } body { margin: 0; } .print-container { width: 100%; } table { page-break-inside: auto; } tr { page-break-inside: avoid; page-break-after: auto; } thead { display: table-header-group; } tfoot { display: table-footer-group; }</style>');
         printWindow.document.write('</head><body>');
         printWindow.document.write(printContent.innerHTML);
         printWindow.document.write('</body></html>');
         printWindow.document.close();
         printWindow.focus();
         setTimeout(() => {
             printWindow.print();
             printWindow.close();
         }, 500);
    }, 100);
  };

  const openBookModal = () => {
      setSelectedBook(availableBooks[0] || '');
      setIsBookModalOpen(true);
  };

  const columns = [
    { header: 'Libro', accessor: 'book_number', className: "w-16 font-mono font-bold" },
    { header: 'Folio', accessor: 'page_number', className: "w-16 font-mono" },
    { header: 'Número', accessor: 'entry_number', className: "w-16 font-mono" },
    { 
        header: 'Esposo', 
        render: (row) => <div><span className="font-bold">{row.groomSurname}</span>, {row.groomName}</div>
    },
    { 
        header: 'Esposa', 
        render: (row) => <div><span className="font-bold">{row.brideSurname}</span>, {row.brideName}</div>
    },
    { 
        header: 'Fecha', 
        render: (row) => row.sacramentDate ? new Date(row.sacramentDate).toLocaleDateString() : '-' 
    },
  ];

  return (
    <DashboardLayout entityName={user?.parishName || 'Parroquia'}>
      <Helmet>
        <title>Índice de Matrimonios · SACRAMENTUM</title>
        <meta name="description" content="Índice general de registros de matrimonio de la parroquia." />
      </Helmet>

      <div className="mx-auto max-w-7xl py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <BookMarked className="w-8 h-8 text-[#4B7BA7]" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 font-serif tracking-tight">Índice de Matrimonios</h1>
            <p className="text-slate-500 font-medium text-xs uppercase tracking-widest mt-1">Base de Datos y Generación de Índices</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
            <div className="bg-white px-3 py-1 rounded-full border border-slate-200 text-sm font-medium text-slate-600 shadow-sm flex items-center">
                <FileText className="w-4 h-4 mr-2 text-blue-500" />
                Total: {records.length}
            </div>
            <div className="bg-white px-3 py-1 rounded-full border border-slate-200 text-sm font-medium text-slate-600 shadow-sm flex items-center">
                <Filter className="w-4 h-4 mr-2 text-green-500" />
                Libros: {availableBooks.length}
            </div>
        </div>
      </div>

      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-3 justify-between items-center">
         <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
                type="text" 
                placeholder="Buscar por contrayentes o libro..." 
                className="w-full bg-transparent border-none text-sm font-medium text-slate-800 uppercase tracking-wide pl-10 pr-4 py-3 outline-none focus:ring-0 placeholder:text-slate-300"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
         <div className="flex gap-2 w-full md:w-auto">
             <Button variant="outline" onClick={() => openBookModal()} className="flex-1 md:flex-none gap-2 rounded-xl font-bold uppercase text-[10px] tracking-widest">
                 <Printer className="w-4 h-4" /> Imprimir por Libro
             </Button>
             <Button variant="secondary" onClick={() => handlePrint(null)} className="flex-1 md:flex-none gap-2 rounded-xl font-bold uppercase text-[10px] tracking-widest">
                 <Printer className="w-4 h-4" /> Imprimir General
             </Button>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <Table columns={columns} data={filteredRecords} />
        {filteredRecords.length === 0 && !loading && (
            <div className="text-center py-10 text-slate-500">
                No se encontraron registros.
            </div>
        )}
        {loading && (
            <div className="text-center py-10 text-slate-500">Cargando registros...</div>
        )}
      </div>

      <Modal isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} title="Seleccionar Libro">
           <div className="space-y-4">
               <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl"><p className="text-xs text-blue-900 font-medium leading-relaxed">Seleccione el número de libro que desea imprimir.</p></div>
               <select 
                  className="w-full p-4 border border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-[#4B7BA7] focus:border-[#4B7BA7] outline-none"
                  value={selectedBook}
                  onChange={(e) => setSelectedBook(e.target.value)}
               >
                   {availableBooks.length === 0 && <option value="">No hay libros disponibles</option>}
                   {availableBooks.map(b => (
                       <option key={b} value={b}>Libro {b}</option>
                   ))}
               </select>
               <div className="flex justify-end gap-2 pt-4">
                   <Button variant="ghost" onClick={() => setIsBookModalOpen(false)} className="font-bold uppercase text-[10px] tracking-widest">Cancelar</Button>
                   <Button variant="secondary"
                       className="font-black uppercase text-[10px] tracking-widest"
                       onClick={() => {
                           setIsBookModalOpen(false);
                           handlePrint(selectedBook);
                       }}
                       disabled={!selectedBook}
                   >
                       Imprimir
                   </Button>
               </div>
           </div>
      </Modal>
      </div>

      <div id="marriage-index-print" className="hidden">
           <MarriageIndexPrintTemplate 
               data={printData} 
               parishInfo={parishInfo} 
               filterBook={currentPrintFilter}
           />
      </div>

    </DashboardLayout>
  );
};

export default MarriageIndexPage;