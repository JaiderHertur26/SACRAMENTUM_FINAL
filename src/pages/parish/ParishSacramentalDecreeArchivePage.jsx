import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArchiveRestore,
  BookOpen,
  Eye,
  FileCheck2,
  History,
  Loader2,
  RefreshCw,
  Search
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import DecreeCenterHeader, {
  DECREE_SACRAMENT_META
} from '@/components/chancery/DecreeCenterHeader';
import {
  listDecrees,
  normalizeDecreeType,
  normalizeSacramentType
} from '@/services/decreeRegistryService';

const pad = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const text = String(value);
  return /^\d+$/.test(text) ? text.padStart(4, '0') : text;
};

const locationText = (value = {}) => {
  const book = value.book || value.libro || value.book_number || value.Libro;
  const folio = value.folio || value.page || value.page_number || value.Folio;
  const number = value.number || value.entry || value.entry_number || value.numero || value.Número;
  return `L-${pad(book)} · F-${pad(folio)} · N-${pad(number)}`;
};

const formatDate = (value) => {
  if (!value) return '—';
  const text = String(value).slice(0, 10);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
};

const statusMeta = (status) => {
  const key = String(status || '').toLowerCase();
  if (key === 'reversed' || key === 'revertida') {
    return { label: 'Revertido', className: 'border-red-200 bg-red-50 text-red-700' };
  }
  if (key === 'cancelled' || key === 'cancelado') {
    return { label: 'Cancelado', className: 'border-slate-200 bg-slate-50 text-slate-600' };
  }
  return { label: 'Vigente', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
};

const ParishSacramentalDecreeArchivePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawType = String(searchParams.get('type') || '').toLowerCase();
  const rawSacrament = String(searchParams.get('sacrament') || 'bautismo').toLowerCase();

  const typeFilter = rawType === 'reposicion'
    ? 'reposicion'
    : rawType === 'correccion'
      ? 'correccion'
      : 'all';

  const sacrament = normalizeSacramentType(rawSacrament);
  const mode = typeFilter === 'correccion'
    ? 'correction'
    : typeFilter === 'reposicion'
      ? 'reposition'
      : 'archive';

  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.parishId) return;
    setLoading(true);
    try {
      const data = await listDecrees({
        parishIds: [user.parishId],
        type: typeFilter === 'all' ? null : typeFilter,
        sacramentType: sacrament
      });
      setRows(data);
    } catch (error) {
      toast({
        title: 'No se pudo consultar el archivo de decretos',
        description: error?.message || 'Supabase rechazó la consulta.',
        variant: 'destructive'
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.parishId, typeFilter, sacrament]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((row) => {
      const payload = row.payload || {};
      return [
        row.decreeNumber,
        row.decreeDate,
        row.targetName,
        row.decreeType,
        row.sacramentType,
        payload.reason,
        payload.fundamento,
        payload.causa,
        payload.observaciones,
        locationText(row.originalLocation),
        locationText(row.replacementLocation)
      ].filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [rows, query]);

  const updateType = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('type');
    else next.set('type', value);
    if (!next.get('sacrament')) next.set('sacrament', sacrament);
    setSearchParams(next, { replace: true });
  };

  const sacramentLabel = DECREE_SACRAMENT_META[sacrament]?.label || 'Sacramento';

  return (
    <DashboardLayout entityName={user?.parishName || 'Parroquia'}>
      <div className="mx-auto max-w-7xl space-y-7 pb-20">
        <DecreeCenterHeader
          scope="parish"
          mode={mode}
          sacrament={sacrament}
          showBack
        />

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-blue-600">
                Archivo parroquial · {sacramentLabel}
              </p>
              <h2 className="mt-1 font-serif text-2xl font-black text-slate-950">
                {typeFilter === 'correccion'
                  ? 'Decretos de Corrección recibidos'
                  : typeFilter === 'reposicion'
                    ? 'Decretos de Reposición recibidos'
                    : 'Archivo de Decretos recibidos'}
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                Decretos emitidos por Cancillería para esta parroquia. La Parroquia puede
                consultar, imprimir y revisar la trazabilidad, pero no emitir ni revertir decretos.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                ['all', 'Todos'],
                ['correccion', 'Correcciones'],
                ['reposicion', 'Reposiciones']
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateType(value)}
                  className={[
                    'rounded-xl border px-4 py-2 text-[9px] font-black uppercase tracking-widest transition',
                    typeFilter === value
                      ? value === 'reposicion'
                        ? 'border-amber-500 bg-amber-500 text-slate-950'
                        : value === 'correccion'
                          ? 'border-blue-700 bg-blue-700 text-white'
                          : 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 border-b border-slate-100 p-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                className="pl-10"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar decreto, titular, libro, folio o número"
              />
            </div>
            <Button variant="outline" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>

          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-slate-400" />
              <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                Consultando Cancillería…
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-4 font-serif text-xl font-black text-slate-500">
                Sin decretos para este espacio
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-slate-400">
                Cuando Cancillería emita un decreto de {typeFilter === 'all' ? 'Corrección o Reposición' : typeFilter === 'correccion' ? 'Corrección' : 'Reposición'} para {sacramentLabel},
                aparecerá aquí automáticamente.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const type = normalizeDecreeType(row.decreeType);
                const state = statusMeta(row.status);
                const correction = type === 'correccion';
                const Icon = correction ? FileCheck2 : ArchiveRestore;

                return (
                  <article key={row.id} className="p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className={[
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                          correction ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                        ].join(' ')}>
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-mono text-sm font-black text-slate-950">
                              {row.decreeNumber || 'SIN NÚMERO'}
                            </h3>
                            <span className={[
                              'rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-wider',
                              correction
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                            ].join(' ')}>
                              {correction ? 'Corrección' : 'Reposición'}
                            </span>
                            <span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-wider ${state.className}`}>
                              {state.label}
                            </span>
                          </div>

                          <p className="mt-2 truncate text-sm font-black uppercase text-slate-800">
                            {row.targetName || 'Expediente sacramental'}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-slate-500">
                            <span>Fecha: <strong className="text-slate-700">{formatDate(row.decreeDate)}</strong></span>
                            <span>Sacramento: <strong className="text-slate-700">{sacramentLabel}</strong></span>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px]">
                            {correction ? (
                              <span className="text-red-600">
                                Original anulada: {locationText(row.originalLocation)}
                              </span>
                            ) : null}
                            <span className="text-amber-700">
                              Partida supletoria: {locationText(row.replacementLocation)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/parish/decrees/${row.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver decreto
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-relaxed text-slate-600">
          <div className="flex items-start gap-3">
            <History className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>
              Este archivo utiliza la misma clasificación que Cancillería. La trazabilidad del decreto,
              la partida original cuando existe y la partida supletoria permanecen vinculadas en el expediente.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ParishSacramentalDecreeArchivePage;
