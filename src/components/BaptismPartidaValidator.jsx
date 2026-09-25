import React, { useState } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { 
    AlertTriangle, 
    Copy, 
    ChevronDown, 
    ChevronUp, 
    ShieldCheck, 
    Terminal,
    Eye
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const BaptismPartidaValidator = ({ rawData }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { purificarRegistroBautismo } = useAppData(); 
    const { toast } = useToast();
    
    if (!rawData) return null;

    // Pasamos los datos por el motor del Cerebro Global
    const normalized = purificarRegistroBautismo(rawData);

    // Verificación mínima de integridad documental.
    // Los libros antiguos pueden carecer legítimamente de algunos datos civiles o marginales;
    // el sistema nunca debe obligar a inventarlos para considerar localizable la partida.
    const criticalFields = [
        { key: 'Libro', label: 'Libro' },
        { key: 'folio', label: 'Folio' },
        { key: 'numero', label: 'Número (Acta)' },
        { key: 'apellidos', label: 'Apellidos' },
        { key: 'nombres', label: 'Nombres' },
        { key: 'fechaSacramento', label: 'Fecha Bautismo' }
    ];

    // Identificamos cuáles campos están vacíos o marcados con el fallback '---'
    const missingFields = criticalFields
        .filter(f => !normalized[f.key] || normalized[f.key] === '---' || normalized[f.key] === '0000')
        .map(f => f.label);

    const isValid = missingFields.length === 0;

    const copyToClipboard = (data, label) => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        toast({ title: "Copiado", description: `JSON de ${label} copiado.` });
    };

    return (
        <div className="mt-6 border rounded-[1.5rem] overflow-hidden bg-white shadow-sm border-slate-200">
            {/* Header del Validador */}
            <div 
                className={`flex items-center justify-between p-5 cursor-pointer transition-all ${isOpen ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl ${isValid ? 'bg-green-100 text-green-600 shadow-sm' : 'bg-amber-100 text-amber-600 shadow-sm'}`}>
                        {isValid ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            Inspección Técnica de Partida
                            {!isValid && (
                                <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md animate-pulse">
                                    DATOS PENDIENTES
                                </span>
                            )}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tight">
                            {isValid 
                                ? 'Integridad documental mínima verificada para localizar e imprimir la partida.' 
                                : `Faltan ${missingFields.length} datos esenciales para identificar la partida.`}
                        </p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" className="rounded-full">
                    {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </Button>
            </div>

            {/* Panel Expandible */}
            {isOpen && (
                <div className="p-6 border-t border-slate-100 bg-white animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        {/* RAW DATA NUBE */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Terminal className="w-3 h-3" /> Datos Origen (Supabase)
                                </h5>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(rawData, 'Origen')}>
                                    <Copy className="w-3 h-3 text-slate-400" />
                                </Button>
                            </div>
                            <div className="bg-slate-900 rounded-2xl p-5 overflow-auto max-h-72 custom-scrollbar">
                                <pre className="text-[10px] font-mono text-blue-300 leading-relaxed">
                                    {JSON.stringify(rawData, null, 2)}
                                </pre>
                            </div>
                        </div>

                        {/* NORMALIZED DATA CEREBRO */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h5 className="text-[9px] font-black text-[#4B7BA7] uppercase tracking-widest flex items-center gap-2">
                                    <Eye className="w-3 h-3" /> Resultado Purificado
                                </h5>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-[#4B7BA7]" onClick={() => copyToClipboard(normalized, 'Salida')}>
                                    <Copy className="w-3 h-3" />
                                </Button>
                            </div>
                            <div className="bg-blue-50/50 border border-blue-100/50 rounded-2xl p-5 overflow-auto max-h-72 custom-scrollbar shadow-inner">
                                <pre className="text-[10px] font-mono text-[#2c4b69] leading-relaxed">
                                    {JSON.stringify(normalized, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>

                    {/* Resumen de Alerta */}
                    <div className={`mt-8 p-5 rounded-2xl border ${isValid ? 'bg-green-50/50 border-green-100' : 'bg-amber-50 border-amber-100 shadow-sm'}`}>
                        {isValid ? (
                            <div className="flex items-center gap-3 text-green-700 font-black text-[11px] uppercase tracking-wider">
                                <ShieldCheck className="w-5 h-5" />
                                Verificación exitosa: la referencia física, identidad y fecha sacramental están completas.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-amber-700 font-black text-[11px] uppercase tracking-wider">
                                    <AlertTriangle className="w-5 h-5" />
                                    Datos esenciales incompletos: revise la partida física antes de imprimir.
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 ml-8">
                                    {missingFields.map(f => (
                                        <div key={f} className="text-[10px] text-amber-600 font-black uppercase flex items-center gap-2 bg-amber-100/50 px-2 py-1 rounded-md">
                                            <div className="w-1 h-1 bg-amber-500 rounded-full" /> {f}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BaptismPartidaValidator;