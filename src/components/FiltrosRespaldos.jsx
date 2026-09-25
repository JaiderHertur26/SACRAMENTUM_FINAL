import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/button';
import { Search, RotateCcw } from 'lucide-react';

const FiltrosRespaldos = ({ onFilterChange, availableParishes }) => {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('Todos');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [receiverParishId, setReceiverParishId] = useState('Todas');

    // Debounce for search
    useEffect(() => {
        const handler = setTimeout(() => {
            triggerChange();
        }, 300);
        return () => clearTimeout(handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    // Trigger immediately for other filters
    useEffect(() => {
        triggerChange();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, dateFrom, dateTo, receiverParishId]);

    const triggerChange = () => {
        onFilterChange({
            search,
            status,
            dateFrom,
            dateTo,
            receiverParishId
        });
    };

    const handleClear = () => {
        setSearch('');
        setStatus('Todos');
        setDateFrom('');
        setDateTo('');
        setReceiverParishId('Todas');
    };

    const parishOptions = [
        { value: 'Todas', label: 'Todas las parroquias receptoras' },
        ...availableParishes.map(p => ({ value: p.id, label: p.name }))
    ];

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Search */}
                <div className="md:col-span-4 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <Input
                        type="text"
                        placeholder="Buscar nombre, cónyuge o consecutivo..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Status Radio Buttons */}
                <div className="md:col-span-5 flex items-center gap-4 bg-slate-50 px-3 rounded-md border border-slate-200 h-10 overflow-x-auto whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-700">Estado:</span>
                    <label className="flex items-center gap-1 cursor-pointer text-sm">
                        <input type="radio" name="status" value="Todos" checked={status === 'Todos'} onChange={(e) => setStatus(e.target.value)} className="text-blue-600" />
                        Todos
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-sm">
                        <input type="radio" name="status" value="pending" checked={status === 'pending'} onChange={(e) => setStatus(e.target.value)} className="text-blue-600" />
                        Pendiente
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-sm">
                        <input type="radio" name="status" value="partial" checked={status === 'partial'} onChange={(e) => setStatus(e.target.value)} className="text-blue-600" />
                        Parcial
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-sm">
                        <input type="radio" name="status" value="received" checked={status === 'received'} onChange={(e) => setStatus(e.target.value)} className="text-blue-600" />
                        Recibida
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-sm">
                        <input type="radio" name="status" value="local_processed" checked={status === 'local_processed'} onChange={(e) => setStatus(e.target.value)} className="text-blue-600" />
                        Local
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-sm">
                        <input type="radio" name="status" value="cancelled" checked={status === 'cancelled'} onChange={(e) => setStatus(e.target.value)} className="text-blue-600" />
                        Cancelada
                    </label>
                </div>

                {/* Receiver Parish Select */}
                <div className="md:col-span-3">
                    <Select
                        value={receiverParishId}
                        onChange={(e) => setReceiverParishId(e.target.value)}
                        options={parishOptions}
                        className="h-10"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* Date Range */}
                <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Fecha Desde</label>
                    <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                    />
                </div>
                <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Fecha Hasta</label>
                    <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                    />
                </div>
                <div className="md:col-span-4 flex justify-end">
                    <Button variant="outline" onClick={handleClear} className="flex items-center gap-2 w-full md:w-auto h-10">
                        <RotateCcw className="w-4 h-4" />
                        Limpiar Filtros
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default FiltrosRespaldos;