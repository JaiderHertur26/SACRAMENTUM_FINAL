import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import { Search, Eye, FileText, ShieldAlert, BookOpen, Loader2, Cloud, LockKeyhole } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ViewRepositionDecreeModal from '@/components/modals/ViewRepositionDecreeModal';
import { supabase } from '@/lib/supabaseClient';

const BaptismRepositionListPage = () => {
    const { user } = useAuth();
    const { toast } = useToast();

    const [records, setRecords] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [concepts, setConcepts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedDecree, setSelectedDecree] = useState(null);

    // --- CARGA DE DATOS DE LA NUBE ---
    useEffect(() => { 
        if (user?.parishId) loadParishReplacementsFromCloud(); 
    }, [user]);

    const loadParishReplacementsFromCloud = async () => {
        setLoading(true);
        try {
            // 1. Cargar Conceptos para mapear la causa
            let targetDioceseId = user.dioceseId || user.diocese_id;
            if (!targetDioceseId) {
                const { data: pData } = await supabase.from('parishes').select('diocese_id').eq('id', user.parishId).single();
                if (pData) targetDioceseId = pData.diocese_id;
            }

            if (targetDioceseId) {
                const { data: cData } = await supabase.from('conceptos_anulacion').select('*').eq('diocese_id', targetDioceseId);
                if (cData) setConcepts(cData);
            }

            // 2. Cargar Decretos de Reposición
            const { data, error } = await supabase.from('decretos').select('*').eq('tipo', 'reposicion')
                .eq('parish_id', user.parishId).order('created_at', { ascending: false });

            if (error) throw error;
            const formattedData = data.map(item => {
                const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : (item.payload || {});
                return {
                    ...payload, id: item.id, parish_id: item.parish_id, created_at: item.created_at,
                    status: item.status || payload.status || 'active',
                    decreeNumber: item.decree_number || payload.decreeNumber || payload.numeroDecreto,
                    decreeDate: item.decree_date || payload.decreeDate || payload.fechaDecreto,
                    replacementRecordId: item.replacement_record_id || payload.newPartidaId || null
                };
            });
            setRecords(formattedData);

        } catch (error) { 
            toast({ title: "Error", description: "No se descargaron los decretos.", variant: "destructive" }); 
        } finally { 
            setLoading(false); 
        }
    };


    const resolveName = (summary, fallbackName) => {
        if (summary) {
            const lName = summary.lastName || summary.apellidos || '';
            const fName = summary.firstName || summary.nombres || '';
            if (lName || fName) return `${fName} ${lName}`.trim().toUpperCase();
        }
        return (fallbackName || '---').toUpperCase();
    };

    const getConceptName = (row) => {
        const id = row.conceptoAnulacionId;
        if (row.causa) return row.causa.toUpperCase();
        const c = concepts.find(i => String(i.id) === String(id) || String(i.codigo) === String(id));
        return c ? c.concepto.toUpperCase() : 'REPOSICIÓN DE PARTIDA';
    };

    const pad = (val) => val ? String(val).padStart(4, '0') : '----';

    const filteredRecords = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return records.filter(item => {
            const decreeNum = (item.decreeNumber || item.numeroDecreto || '').toLowerCase();
            const personName = resolveName(item.newPartidaSummary, item.targetName || item.nombres).toLowerCase();
            return decreeNum.includes(term) || personName.includes(term);
        });
    }, [searchTerm, records]);

    const columns = [
        { 
            header: 'No. Decreto', 
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><FileText className="w-4 h-4" /></div>
                    <span className="font-black text-slate-900 font-mono tracking-tighter">{row.decreeNumber || row.numeroDecreto || 'SIN-NÚMERO'}</span>
                </div>
            )
        },
        { 
            header: 'Nueva Partida (Supletoria)', 
            render: (row) => {
                const sum = row.newPartidaSummary || row.datosNuevaPartida || {};
                return (
                    <div className="flex flex-col">
                        <span className="font-bold text-green-600 text-xs uppercase">{resolveName(sum, row.targetName || row.nombres)}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-bold">L:{pad(sum.book || sum.book_number || sum.Libro)} F:{pad(sum.page || sum.page_number || sum.folio)} N:{pad(sum.entry || sum.entry_number || sum.numero)}</span>
                    </div>
                );
            }
        },
        { 
            header: 'Causa / Concepto', 
            render: (row) => (
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight block max-w-[180px] truncate">{getConceptName(row)}</span>
            )
        },
        { header: 'Fecha', render: (row) => <span className="text-xs font-medium text-slate-500">{row.decreeDate || row.fechaDecreto}</span> },
        {
            header: 'Acciones', className: "text-right",
            render: (row) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50 rounded-xl" onClick={() => { setSelectedDecree(row); setViewModalOpen(true); }}><Eye className="w-4 h-4" /></Button>
                </div>
            )
        }
    ];

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    {/* Usamos tono Azul para distinguir sutilmente de las Correcciones (Ámbar) pero con el mismo diseño */}
                    <div className="bg-blue-100 p-3 rounded-2xl text-blue-600 relative">
                        <ShieldAlert className="w-7 h-7" />
                        <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5">
                            <Cloud className="w-3 h-3 text-white" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 font-serif">Archivo de Reposiciones</h1>
                        <p className="text-slate-500 text-sm font-medium uppercase text-[10px] tracking-widest">Partidas Supletorias Sincronizadas (Nube)</p>
                    </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-xs font-black uppercase tracking-wider text-amber-800">
                    <LockKeyhole className="w-4 h-4" /> Emisión exclusiva de Cancillería
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-8 bg-slate-50/50 border-b border-slate-100">
                    <div className="relative max-w-md group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[#4B7BA7] transition-colors" />
                        <Input placeholder="Buscar por decreto o nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 py-7 text-sm rounded-2xl border-slate-200 bg-white shadow-sm focus:ring-4 focus:ring-blue-500/5 transition-all" />
                    </div>
                </div>

                {loading ? (
                    <div className="py-24 text-center">
                        <Loader2 className="w-10 h-10 animate-spin text-[#4B7BA7] mx-auto mb-4" />
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Descargando...</p>
                    </div>
                ) : filteredRecords.length > 0 ? (
                    <Table columns={columns} data={filteredRecords} className="border-none" />
                ) : (
                    <div className="py-32 text-center">
                        <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-6" />
                        <h3 className="text-lg font-black text-slate-400 uppercase">Sin Coincidencias</h3>
                    </div>
                )}
            </div>

            {viewModalOpen && <ViewRepositionDecreeModal isOpen={viewModalOpen} onClose={() => { setViewModalOpen(false); setSelectedDecree(null); }} decreeData={selectedDecree} />}
            

        </DashboardLayout>
    );
};

export default BaptismRepositionListPage;