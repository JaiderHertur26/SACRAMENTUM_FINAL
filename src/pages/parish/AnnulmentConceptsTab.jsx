import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Search, FileText, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Table from '@/components/ui/Table';
import { supabase } from '@/lib/supabaseClient'; 
import { cn } from '@/lib/utils';

const AnnulmentConceptsTab = ({ onSelectConcept }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [concepts, setConcepts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            let targetDioceseId = user.dioceseId || user.diocese_id;

            if (!targetDioceseId) {
                if (user.role === 'PARROQUIA' || user.parishId) {
                    const { data: parish } = await supabase
                        .from('parishes')
                        .select('diocese_id')
                        .eq('id', user.parishId)
                        .single();
                    if (parish) targetDioceseId = parish.diocese_id;
                } else if (user.role === 'CANCILLERIA' || user.chanceryId) {
                    const { data: chancery } = await supabase
                        .from('chancelleries')
                        .select('diocese_id')
                        .eq('id', user.chanceryId)
                        .single();
                    if (chancery) targetDioceseId = chancery.diocese_id;
                }
            }

            if (!targetDioceseId) {
                throw new Error("No se pudo determinar a qué Diócesis pertenece el usuario.");
            }

            // 🚀 AHORA TRAEMOS TODOS LOS CAMPOS TÉCNICOS
            const { data, error } = await supabase
                .from('conceptos_anulacion')
                .select('id, codigo, concepto, seinscribe, gennota, gendocum, enlibro, expide, created_at, diocese_id, is_active')
                .eq('diocese_id', targetDioceseId)
                .eq('is_active', true)
                .order('codigo', { ascending: true });

            if (error) {
                throw error;
            }
            
            setConcepts(data || []);
            
        } catch (error) {
            console.error("Error loading concepts from Supabase:", error.message);
            toast({ title: "Error", description: "No se pudieron cargar los conceptos desde la nube.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const filteredConcepts = concepts
        .filter(c => {
            const term = searchTerm.toLowerCase();
            return (c.codigo || '').toLowerCase().includes(term) || (c.concepto || '').toLowerCase().includes(term);
        })
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }));

    const handleSelectForNotes = (concept, e) => {
        e?.stopPropagation();
        if (onSelectConcept) {
            onSelectConcept(concept);
            toast({
                title: "Concepto Seleccionado",
                description: `Preparando motor para: ${concept.concepto}`,
                className: "bg-[#4B7BA7] text-white"
            });
        }
    };

    // 🚀 TABLA INTELIGENTE QUE REFLEJA TU ESTRUCTURA JSON
    const columns = [
        { header: 'Código', render: (row) => <span className="font-mono text-xs font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">{row.codigo}</span> },
        { header: 'Concepto / Decreto', render: (row) => <span className="font-bold text-slate-900 uppercase text-xs tracking-tight">{row.concepto}</span> },
        { 
            header: 'Libro Afectado', 
            render: (row) => {
                let label = 'GENERAL (TODOS)';
                let colorClass = 'bg-slate-100 text-slate-600 border-slate-200';
                
                if (row.enlibro === 1) { 
                    label = 'CONFIRMACIÓN'; 
                    colorClass = 'bg-red-50 text-red-700 border-red-200'; 
                } else if (row.enlibro === 2) { 
                    label = 'BAUTISMO / MATRIMONIO'; 
                    colorClass = 'bg-blue-50 text-[#4B7BA7] border-blue-200'; 
                }

                return <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border whitespace-nowrap", colorClass)}>{label}</span>;
            } 
        },
        { 
            header: 'Acciones Automáticas', 
            render: (row) => (
                <div className="flex gap-1.5 flex-wrap">
                    {row.seinscribe && <span className="text-[8px] font-black uppercase bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded shadow-sm">Se Inscribe</span>}
                    {row.gennota && <span className="text-[8px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded shadow-sm">Genera Nota</span>}
                    {row.gendocum && <span className="text-[8px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded shadow-sm">Emite Doc.</span>}
                    {!row.seinscribe && !row.gennota && !row.gendocum && <span className="text-[8px] font-black uppercase text-slate-400">Sólo Texto</span>}
                </div>
            ) 
        },
        { header: 'Autoridad Expide', render: (row) => <span className="text-slate-500 font-bold text-[9px] uppercase tracking-widest">{row.expide || '---'}</span> },
        {
            header: 'Acciones',
            className: 'text-right w-24',
            render: (row) => (
                <div className="flex justify-end gap-2">
                    {onSelectConcept ? (
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-green-600 hover:bg-green-50 rounded-xl" onClick={(e) => handleSelectForNotes(row, e)} title="Usar concepto en la nota">
                            <FileText className="w-4 h-4" />
                        </Button>
                    ) : <LockKeyhole className="w-4 h-4 text-slate-300" title="Catálogo administrado por Cancillería" />}
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                 <div className="relative w-full max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#4B7BA7] w-5 h-5 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Buscar por código o concepto..." 
                        className="w-full pl-12 pr-4 py-4 border-none bg-white rounded-2xl shadow-sm focus:ring-4 focus:ring-[#4B7BA7]/10 outline-none text-slate-900 text-sm font-bold uppercase transition-all" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border px-4 py-3 rounded-xl">
                    <LockKeyhole className="w-4 h-4" /> Catálogo diocesano · solo lectura
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <Table 
                    columns={columns} 
                    data={filteredConcepts} 
                    isLoading={isLoading}
                    className="border-none"
                />
                {!isLoading && filteredConcepts.length === 0 && (
                    <div className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                        No se encontraron conceptos en la Nube.
                    </div>
                )}
            </div>
            
        </div>
    );
};

export default AnnulmentConceptsTab;