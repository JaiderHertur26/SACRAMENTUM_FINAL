import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Church, FileClock, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { Helmet } from 'react-helmet';

import DashboardLayout from '@/components/DashboardLayout';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { loadChanceryPendingSacraments } from '@/services/chanceryPendingService';

const SACRAMENT_TYPES = ['Todos', 'Bautismo', 'Confirmación', 'Matrimonio', 'Exequias'];

const formatDate = (value) => {
  if (!value) return '—';
  const dateOnly = String(value).slice(0, 10);
  const [year, month, day] = dateOnly.split('-');
  if (year && month && day) return `${day}/${month}/${year}`;
  return String(value);
};

const formatTimestamp = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
};

const ChanceryPendingPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('Todos');

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadChanceryPendingSacraments(user);
      setRows(result.rows || []);
    } catch (error) {
      console.error('No fue posible cargar los pendientes diocesanos:', error);
      toast({
        title: 'No fue posible cargar los pendientes',
        description: error?.message || 'Verifica la conexión y los permisos de Cancillería.',
        variant: 'destructive',
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const filteredRows = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter !== 'Todos' && row.sacramentType !== typeFilter) return false;
      if (!needle) return true;
      return [
        row.personName,
        row.parishName,
        row.sacramentType,
        row.registrationNumber,
        row.sacramentDate,
      ].some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [rows, searchTerm, typeFilter]);

  const counts = useMemo(() => SACRAMENT_TYPES.slice(1).map((type) => ({
    type,
    count: rows.filter((row) => row.sacramentType === type).length,
  })), [rows]);

  const columns = [
    {
      header: 'Sacramento',
      render: (row) => <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#3A6286]">{row.sacramentType}</span>,
    },
    {
      header: 'Persona / expediente',
      render: (row) => <span className="font-black text-slate-900">{row.personName}</span>,
    },
    {
      header: 'Parroquia',
      render: (row) => <span className="text-sm font-bold text-slate-600">{row.parishName}</span>,
    },
    {
      header: 'Fecha sacramental',
      render: (row) => <span className="text-sm font-bold text-slate-600">{formatDate(row.sacramentDate)}</span>,
    },
    {
      header: 'Radicado',
      render: (row) => <span className="text-xs font-medium text-slate-500">{formatTimestamp(row.createdAt)}</span>,
    },
    {
      header: 'Estado',
      render: () => <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800"><FileClock className="h-3.5 w-3.5" /> Pendiente parroquial</span>,
    },
  ];

  return (
    <DashboardLayout entityName={`Cancillería • ${user?.dioceseName || user?.diocese_name || 'Jurisdicción'}`}>
      <Helmet><title>Pendientes Diocesanos · SACRAMENTUM</title></Helmet>

      <div className="mx-auto max-w-7xl pb-20">
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[#4B7BA7]">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.25em]">Seguimiento diocesano</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Pendientes Sacramentales</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-500">
              Vista informativa de expedientes pendientes reportados por las parroquias de la jurisdicción. El asiento sacramental continúa siendo responsabilidad de la parroquia correspondiente.
            </p>
          </div>
          <Button variant="outline" onClick={loadRows} disabled={loading} className="gap-2 rounded-2xl">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><AlertCircle className="h-5 w-5" /></div>
            <div className="text-3xl font-black tracking-tight text-slate-950">{rows.length}</div>
            <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Total pendientes</div>
          </div>
          {counts.map(({ type, count }) => (
            <div key={type} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#4B7BA7]"><Church className="h-5 w-5" /></div>
              <div className="text-3xl font-black tracking-tight text-slate-950">{count}</div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">{type}</div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/60 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-lg">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar persona, parroquia, registro o fecha..." className="h-12 rounded-2xl bg-white pl-11" />
            </div>
            <div className="flex flex-wrap gap-2">
              {SACRAMENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${typeFilter === type ? 'bg-[#4B7BA7] text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Loader2 className="mb-4 h-9 w-9 animate-spin text-[#4B7BA7]" />
              <span className="text-[10px] font-black uppercase tracking-widest">Consultando pendientes de la jurisdicción...</span>
            </div>
          ) : filteredRows.length ? (
            <div className="p-4"><Table columns={columns} data={filteredRows} className="border-none shadow-none" /></div>
          ) : (
            <div className="py-24 text-center">
              <FileClock className="mx-auto mb-4 h-10 w-10 text-slate-200" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Sin pendientes para mostrar</h3>
              <p className="mt-2 text-sm text-slate-400">No hay expedientes que coincidan con los filtros seleccionados.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ChanceryPendingPage;
