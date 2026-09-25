import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Search, Eye, FileText, ShieldAlert, BookOpen, ArrowRight, Loader2, Cloud, Printer, LockKeyhole } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ViewCorrectionDecreeModal from '@/components/modals/ViewCorrectionDecreeModal';
import { supabase } from '@/lib/supabaseClient';
import { useReactToPrint } from 'react-to-print';
import ConfirmationCorrectionPrintTemplate from '@/components/ConfirmationCorrectionPrintTemplate';

const ConfirmationCorrectionListPage = () => {
    const { user } = useAuth();
    const { getMisDatosList, getParrocos } = useAppData(); 
    const navigate = useNavigate();
    const { toast } = useToast();

    const [corrections, setCorrections] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedDecree, setSelectedDecree] = useState(null);

    const printRef = useRef(null);
    
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: 'Decreto_Correccion_Confirmacion'
    });

    const onPrintClick = (row) => {
        setSelectedDecree(row);
        setTimeout(() => handlePrint(), 300);
    };

    const misDatosList = user?.parishId ? getMisDatosList(user.parishId) : [];
    const parrocos = user?.parishId ? getParrocos(user.parishId) : [];
    const parrocoActivo = parrocos?.find(p => String(p.estado || p.Estado) === '1');
    const parrocoNombre = parrocoActivo ? `${parrocoActivo.nombre} ${parrocoActivo.apellido || ''}`.trim() : '';
    const parroquiaInfo = misDatosList?.[0] || {};
    
    const printData = selectedDecree ? {
        ...selectedDecree,
        parroquiaInfo,
        parroquiaNombre: parroquiaInfo.nombre || user?.parishName,
        ciudad: parroquiaInfo.ciudad || user?.city,
        parrocoNombre
    } : {};

    useEffect(() => { if (user?.parishId) loadParishCorrectionsFromCloud(); }, [user]);

    const loadParishCorrectionsFromCloud = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('decretos').select('*').eq('tipo', 'correccion')
                .eq('parish_id', user.parishId).order('created_at', { ascending: false });

            if (error) throw error;
            
            // 🚀 FILTRO BLINDADO: Extrae solo los que NO tengan abuelosPaternos (exclusivos Confirmación)
            const formattedData = data.map(item => ({
                id: item.id, parish_id: item.parish_id, created_at: item.created_at,
                ...(typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload)
            })).filter(item => !('abuelosPaternos' in item) || item.sacramento === 'confirmacion');
            
            setCorrections(formattedData);
        } catch (error) { toast({ title: "Error", description: "No se descargaron los decretos.", variant: "destructive" }); } 
        finally { setLoading(false); }
    };


    const resolveName = (summary, fallbackName) => {
        if (summary) {
            const lName = summary.lastName || summary.apellidos || '';
            const fName = summary.firstName || summary.nombres || '';
            if (lName || fName) return `${fName} ${lName}`.trim().toUpperCase();
        }
        return (fallbackName || '---').toUpperCase();
    };

    const pad = (val) => val ? String(val).padStart(4, '0') : '----';

    const filteredCorrections = corrections.filter(item => {
        const term = searchTerm.toLowerCase();
        return (item.decreeNumber || '').toLowerCase().includes(term) || resolveName(item.originalPartidaSummary, item.targetName).toLowerCase().includes(term);
    });

    const columns = [
        { 
            header: 'No. Decreto', 
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="bg-red-50 p-2 rounded-lg text-red-600"><FileText className="w-4 h-4" /></div>
                    <span className="font-black text-slate-900 font-mono tracking-tighter">{row.decreeNumber || 'SIN-NÚMERO'}</span>
                </div>
            )
        },
        { 
            header: 'Partida Anulada', 
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-bold text-red-600 text-xs uppercase">{resolveName(row.originalPartidaSummary, row.targetName)}</span>
                    <span className="text-[10px] text-slate-400 font-mono">L:{pad(row.originalPartidaSummary?.book || row.originalPartidaSummary?.Libro)} F:{pad(row.originalPartidaSummary?.page || row.originalPartidaSummary?.folio)} N:{pad(row.originalPartidaSummary?.entry || row.originalPartidaSummary?.numero)}</span>
                </div>
            )
        },
        { header: '', render: () => <ArrowRight className="w-4 h-4 text-slate-300" />, className: "w-4 px-0" },
        { 
            header: 'Nueva Partida (Supletoria)', 
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-bold text-green-600 text-xs uppercase">{resolveName(row.newPartidaSummary, row.newTargetName)}</span>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">L:{pad(row.newPartidaSummary?.book || row.newPartidaSummary?.Libro)} F:{pad(row.newPartidaSummary?.page || row.newPartidaSummary?.folio)} N:{pad(row.newPartidaSummary?.entry || row.newPartidaSummary?.numero)}</span>
                </div>
            )
        },
        { header: 'Fecha', render: (row) => <span className="text-xs font-medium text-slate-500">{row.decreeDate}</span> },
        {
            header: 'Acciones', className: "text-right",
            render: (row) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50 rounded-xl" onClick={() => { setSelectedDecree(row); setViewModalOpen(true); }}><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50 rounded-xl" onClick={() => onPrintClick(row)}><Printer className="w-4 h-4" /></Button>
                </div>
            )
        }
    ];

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 relative"><ShieldAlert className="w-7 h-7" /><div className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5"><Cloud className="w-3 h-3 text-white" /></div></div>
                    <div><h1 className="text-3xl font-black text-slate-900 font-serif">Archivo de Decretos</h1><p className="text-slate-500 text-sm font-medium uppercase text-[10px] tracking-widest">Correcciones de Confirmación</p></div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-amber-800" title="Los decretos de corrección son emitidos exclusivamente por Cancillería.">
                    <LockKeyhole className="w-4 h-4" /> Emisión exclusiva de Cancillería
                </div>
            </div>

            {/* 🚀 SOLUCIÓN DE PESTAÑAS: El onValueChange fuerza el viaje a la otra página */}
            <Tabs 
                value="confirmaciones" 
                onValueChange={(val) => {
                    if (val === 'bautizos') navigate('/parroquia/decretos/ver-correcciones');
                }} 
                className="w-full mb-8"
            >
                <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-2xl h-14">
                    <TabsTrigger value="bautizos" className="rounded-xl font-bold uppercase text-[10px] tracking-widest cursor-pointer text-slate-500 hover:bg-slate-200/50 transition-all">Bautizos</TabsTrigger>
                    <TabsTrigger value="confirmaciones" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm">Confirmaciones</TabsTrigger>
                    <TabsTrigger value="matrimonios" disabled className="opacity-30 rounded-xl font-bold uppercase text-[10px] tracking-widest">Matrimonios</TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-8 bg-slate-50/50 border-b border-slate-100">
                    <div className="relative max-w-md group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-red-600 transition-colors" /><Input placeholder="Buscar por acta, decreto o nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 py-7 text-sm rounded-2xl border-slate-200 bg-white shadow-sm focus:ring-4 focus:ring-red-500/5 transition-all" /></div>
                </div>

                {loading ? (
                    <div className="py-24 text-center"><Loader2 className="w-10 h-10 animate-spin text-red-600 mx-auto mb-4" /><p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Descargando...</p></div>
                ) : filteredCorrections.length > 0 ? (
                    <Table columns={columns} data={filteredCorrections} className="border-none" />
                ) : (
                    <div className="py-32 text-center"><BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-6" /><h3 className="text-lg font-black text-slate-400 uppercase">Sin Coincidencias</h3></div>
                )}
            </div>

            {viewModalOpen && <ViewCorrectionDecreeModal isOpen={viewModalOpen} onClose={() => { setViewModalOpen(false); setSelectedDecree(null); }} decreeData={selectedDecree} sacrament="confirmacion" />}

            <div style={{ display: 'none' }}>
                <ConfirmationCorrectionPrintTemplate ref={printRef} data={printData} />
            </div>

        </DashboardLayout>
    );
};

export default ConfirmationCorrectionListPage;