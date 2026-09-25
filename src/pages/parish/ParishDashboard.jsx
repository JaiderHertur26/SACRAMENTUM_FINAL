import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { purificarRegistroBautismo } from '@/services/sacramentsService';
import { Button } from '@/components/ui/button';
import {
  Church,
  ScrollText,
  Activity,
  AlertCircle,
  Clock,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Landmark,
  FileStack,
  ChevronRight,
  Zap,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Heart,
  Droplets,
  Sparkles,
  Archive,
  BookOpen,
  Cross
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const CARD_THEMES = {
  baptisms: {
    label: 'Bautizos',
    description: 'Partidas asentadas',
    icon: Droplets,
    accent: 'text-blue-600',
    iconBg: 'bg-blue-50',
    border: 'border-blue-100/80',
    glow: 'from-blue-500/10 via-blue-400/5 to-transparent',
    route: '/parroquia/bautismo/partidas'
  },
  confirmations: {
    label: 'Confirmaciones',
    description: 'Partidas asentadas',
    icon: ScrollText,
    accent: 'text-blue-600',
    iconBg: 'bg-blue-50',
    border: 'border-blue-100/80',
    glow: 'from-blue-500/10 via-blue-400/5 to-transparent',
    route: '/parroquia/confirmacion/partidas'
  },
  marriages: {
    label: 'Matrimonios',
    description: 'Partidas asentadas',
    icon: Heart,
    accent: 'text-blue-700',
    iconBg: 'bg-blue-50',
    border: 'border-blue-100/80',
    glow: 'from-blue-500/10 via-blue-400/5 to-transparent',
    route: '/parroquia/matrimonio/partidas'
  },
  funerals: {
    label: 'Exequias',
    description: 'Partidas asentadas',
    icon: Cross,
    accent: 'text-slate-700',
    iconBg: 'bg-slate-50',
    border: 'border-slate-200/80',
    glow: 'from-slate-500/10 via-slate-400/5 to-transparent',
    route: '/parroquia/exequias/partidas'
  },
  total: {
    label: 'Total Registros',
    description: 'Archivo sacramental',
    icon: FileStack,
    accent: 'text-blue-700',
    iconBg: 'bg-blue-50',
    border: 'border-blue-100/80',
    glow: 'from-blue-500/10 via-blue-400/5 to-transparent',
    route: '/buscar'
  }
};

const QUICK_ACTIONS = [
  {
    label: 'Buscador Unificado',
    description: 'Encuentra personas, partidas y documentos',
    icon: Search,
    route: '/buscar',
    accent: 'text-blue-700',
    iconBg: 'bg-blue-50',
    hover: 'hover:border-blue-200 hover:bg-blue-50/35'
  },
  {
    label: 'Nuevo Bautismo',
    description: 'Registra un bautismo para su posterior asiento',
    icon: Droplets,
    route: '/parroquia/bautismo/nuevo',
    accent: 'text-amber-700',
    iconBg: 'bg-amber-50',
    hover: 'hover:border-amber-200 hover:bg-amber-50/35'
  },
  {
    label: 'Digitalizar partida existente',
    description: 'Transcribe una partida ya asentada en el libro físico',
    icon: BookOpen,
    route: '/parroquia/bautismo/celebrado',
    accent: 'text-violet-700',
    iconBg: 'bg-violet-50',
    hover: 'hover:border-violet-200 hover:bg-violet-50/35'
  },
  {
    label: 'Nueva Confirmación',
    description: 'Registra una nueva confirmación',
    icon: Sparkles,
    route: '/parroquia/confirmacion/nuevo',
    accent: 'text-blue-700',
    iconBg: 'bg-blue-50',
    hover: 'hover:border-blue-200 hover:bg-blue-50/35'
  },
  {
    label: 'Registro Matrimonial',
    description: 'Abre un nuevo expediente matrimonial',
    icon: Heart,
    route: '/parroquia/matrimonio/nuevo',
    accent: 'text-blue-700',
    iconBg: 'bg-blue-50',
    hover: 'hover:border-blue-200 hover:bg-blue-50/35'
  },
  {
    label: 'Registrar Exequias',
    description: 'Gestiona un nuevo registro de exequias',
    icon: Cross,
    route: '/parroquia/exequias',
    accent: 'text-slate-700',
    iconBg: 'bg-slate-50',
    hover: 'hover:border-slate-200 hover:bg-slate-50/60'
  }
];

const safeJson = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const ParishDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [recentRecords, setRecentRecords] = useState([]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [stats, setStats] = useState({
    baptisms: 0,
    confirmations: 0,
    marriages: 0,
    funerals: 0,
    total: 0
  });
  const [hasPending, setHasPending] = useState(false);
  const [pendingTarget, setPendingTarget] = useState(null);

  const currentParishId = user?.parish_id || user?.parishId || null;
  const nombreParroquia = user?.parishName || user?.parish_name || 'PARROQUIA';

  const formatCivilDate = (value) => {
    if (!value) return 'SIN FECHA';
    const raw = String(value).slice(0, 10);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
  };

  const parseSortDate = (dateStr) => {
    if (!dateStr) return 0;
    const str = String(dateStr);

    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return new Date(str.slice(0, 10)).getTime() || 0;
    }

    if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
      const [d, m, y] = str.split('/');
      return new Date(`${y}-${m}-${d}`).getTime() || 0;
    }

    return new Date(str).getTime() || 0;
  };

  const updateDashboardData = useCallback(async () => {
    if (!currentParishId) {
      setIsSyncing(false);
      return;
    }

    setIsSyncing(true);

    try {
      const [bRes, cRes, mRes, fRes, bPendingRes, cPendingRes, mPendingRes, fPendingRes] = await Promise.all([
        supabase
          .from('baptisms')
          .select('*')
          .eq('parish_id', currentParishId),

        supabase
          .from('confirmations')
          .select('id, raw_data, status, celebration_date, created_at')
          .eq('parish_id', currentParishId),

        supabase
          .from('marriages')
          .select('id, raw_data, status, celebration_date, created_at')
          .eq('parish_id', currentParishId),

        supabase
          .from('funerals')
          .select('id, raw_data, status, nombres, apellidos, fecha_exequias, created_at')
          .eq('parish_id', currentParishId),

        supabase
          .from('pending_baptisms')
          .select('id, raw_data, status, reportado, created_at')
          .eq('parish_id', currentParishId)
          .eq('reportado', false),

        supabase
          .from('pending_confirmations')
          .select('id, raw_data, status, reportado, created_at')
          .eq('parish_id', currentParishId)
          .eq('reportado', false),

        supabase
          .from('pending_marriages')
          .select('id, raw_data, status, reportado, celebration_date, created_at')
          .eq('parish_id', currentParishId)
          .eq('reportado', false),

        supabase
          .from('pending_funerals')
          .select('id, raw_data, status, reportado, fecha_exequias, created_at')
          .eq('parish_id', currentParishId)
          .eq('reportado', false)
      ]);

      const queryError = [bRes, cRes, mRes, fRes, bPendingRes, cPendingRes, mPendingRes, fPendingRes]
        .map((result) => result?.error)
        .find(Boolean);
      if (queryError) throw queryError;

      const bData = bRes.data || [];
      const cData = cRes.data || [];
      const mData = mRes.data || [];
      const fData = fRes.data || [];
      const bPendingData = bPendingRes.data || [];
      const cPendingData = cPendingRes.data || [];
      const mPendingData = mPendingRes.data || [];
      const fPendingData = fPendingRes.data || [];

      const bSeated = bData
        .map((row) => purificarRegistroBautismo(row))
        .filter((row) => {
          const status = String(row?.status || '').toLowerCase();
          return row && !['reversed', 'revertida', 'replaced', 'deleted'].includes(status);
        });

      const cSeated = cData.map((row) => {
        const raw = safeJson(row.raw_data);
        return {
          ...raw,
          id: row.id,
          status: row.status,
          sacramentDate:
            row.celebration_date ||
            raw.celebration_date ||
            raw.fechaSacramento ||
            raw.sacramentDate ||
            raw.feccon ||
            '',
          createdAt: row.created_at
        };
      });

      const mSeated = mData.map((row) => {
        const raw = safeJson(row.raw_data);

        return {
          ...raw,
          id: row.id,
          status: row.status,
          sacramentDate:
            row.celebration_date ||
            raw.sacramentDate ||
            raw.fechaMatrimonio ||
            raw.fechaSacramento ||
            raw.fechaHoraPrevista,
          createdAt: row.created_at
        };
      });

      const fSeated = fData.map((row) => {
        const raw = safeJson(row.raw_data);
        return {
          ...raw,
          id: row.id,
          nombres: row.nombres || raw.nombres || '',
          apellidos: row.apellidos || raw.apellidos || '',
          status: row.status,
          sacramentDate: row.fecha_exequias || raw.fechaExequias || raw.fecha_exequias || '',
          createdAt: row.created_at
        };
      }).filter((row) => !['reversed', 'revertida', 'replaced', 'deleted'].includes(String(row.status || '').toLowerCase()));

      const bPending = bPendingData.map((row) => ({
        ...safeJson(row.raw_data),
        id: row.id,
        status: row.status || 'pending',
        createdAt: row.created_at
      }));

      const cPending = cPendingData.map((row) => ({
        ...safeJson(row.raw_data),
        id: row.id,
        status: row.status || 'pending',
        createdAt: row.created_at
      }));

      const mPending = mPendingData.map((row) => {
        const raw = safeJson(row.raw_data);

        return {
          ...raw,
          id: row.id,
          status: row.status || 'pending',
          sacramentDate:
            row.celebration_date ||
            raw.sacramentDate ||
            raw.fechaMatrimonio ||
            raw.fechaSacramento ||
            raw.fechaHoraPrevista,
          createdAt: row.created_at
        };
      });

      const fPending = fPendingData.map((row) => {
        const raw = safeJson(row.raw_data);
        return {
          ...raw,
          id: row.id,
          status: row.status || 'pending',
          sacramentDate: row.fecha_exequias || raw.fechaExequias || raw.fecha_exequias || '',
          createdAt: row.created_at
        };
      });

      setStats({
        baptisms: bSeated.length,
        confirmations: cSeated.length,
        marriages: mSeated.length,
        funerals: fSeated.length,
        total: bSeated.length + cSeated.length + mSeated.length + fSeated.length
      });

      const hasBaptismPending = bPending.length > 0;
      const hasConfirmationPending = cPending.length > 0;
      const hasMarriagePending = mPending.length > 0;
      const hasFuneralPending = fPending.length > 0;
      const anyPending = hasBaptismPending || hasConfirmationPending || hasMarriagePending || hasFuneralPending;

      setHasPending(anyPending);
      setPendingTarget(
        hasBaptismPending
          ? '/parroquia/bautismo/sentar-registros'
          : hasConfirmationPending
            ? '/parroquia/confirmacion/sentar-registros'
            : hasMarriagePending
              ? '/parroquia/matrimonio/sentar-registros'
              : hasFuneralPending
                ? '/parroquia/exequias'
                : null
      );

      const mapRecord = (record, type, label, isPending) => {
        if (!record) return null;

        let nombres = record.firstName || record.nombres || '';
        let apellidos = record.lastName || record.apellidos || '';

        if (type === 'marriage') {
          const groomNames =
            record.novioNombres ||
            record.groomName ||
            record.husbandName ||
            record.nombres_esposo ||
            record.esposo?.nombres ||
            '';

          const groomSurnames =
            record.novioApellidos ||
            record.groomSurname ||
            record.husbandSurname ||
            record.apellidos_esposo ||
            record.esposo?.apellidos ||
            '';

          const brideNames =
            record.noviaNombres ||
            record.brideName ||
            record.wifeName ||
            record.nombres_esposa ||
            record.esposa?.nombres ||
            '';

          const brideSurnames =
            record.noviaApellidos ||
            record.brideSurname ||
            record.wifeSurname ||
            record.apellidos_esposa ||
            record.esposa?.apellidos ||
            '';

          nombres = `${groomNames} ${groomSurnames}`.trim() || 'MATRIMONIO';

          const brideFull = `${brideNames} ${brideSurnames}`.trim();
          apellidos = brideFull ? `& ${brideFull}` : '';
        }

        const recordDate =
          record.sacramentDate ||
          record.celebration_date ||
          record.fechaSacramento ||
          record.fechaMatrimonio ||
          record.fechaHoraPrevista ||
          record.feccon ||
          record.fecha ||
          '';

        return {
          id: record.id,
          nombres: (nombres || 'SIN NOMBRE').toUpperCase(),
          apellidos: (apellidos || '').toUpperCase(),
          sacramento: label,
          fecha: formatCivilDate(recordDate),
          isPending,
          status: record.status || (isPending ? 'pending' : 'seated'),
          source: record.source || '',
          sortDate: parseSortDate(record.createdAt || record.created_at || recordDate)
        };
      };

      const allRecords = [
        ...bPending.map((r) => mapRecord(r, 'baptism', 'Bautismo', true)),
        ...cPending.map((r) => mapRecord(r, 'confirmation', 'Confirmación', true)),
        ...mPending.map((r) => mapRecord(r, 'marriage', 'Matrimonio', true)),
        ...fPending.map((r) => mapRecord(r, 'funeral', 'Exequias', true)),
        ...bSeated.map((r) => mapRecord(r, 'baptism', 'Bautismo', false)),
        ...cSeated.map((r) => mapRecord(r, 'confirmation', 'Confirmación', false)),
        ...mSeated.map((r) => mapRecord(r, 'marriage', 'Matrimonio', false)),
        ...fSeated.map((r) => mapRecord(r, 'funeral', 'Exequias', false))
      ].filter(Boolean);

      allRecords.sort((a, b) => {
        if (a.isPending && !b.isPending) return -1;
        if (!a.isPending && b.isPending) return 1;
        return b.sortDate - a.sortDate;
      });

      setRecentRecords(allRecords.slice(0, 8));
    } catch (error) {
      console.error('Dashboard Sync Error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [currentParishId]);

  useEffect(() => {
    updateDashboardData();
    window.addEventListener('storage', updateDashboardData);

    return () => window.removeEventListener('storage', updateDashboardData);
  }, [updateDashboardData]);

  const statsCards = [
    { ...CARD_THEMES.baptisms, value: stats.baptisms },
    { ...CARD_THEMES.confirmations, value: stats.confirmations },
    { ...CARD_THEMES.marriages, value: stats.marriages },
    { ...CARD_THEMES.funerals, value: stats.funerals },
    { ...CARD_THEMES.total, value: stats.total }
  ];

  return (
    <DashboardLayout entityName={nombreParroquia}>
      <div className="relative mx-auto max-w-[1380px] pb-12">
        <div className="pointer-events-none absolute -top-14 right-0 h-80 w-80 rounded-full bg-blue-100/35 blur-3xl" />
        <div className="pointer-events-none absolute top-44 left-1/4 h-64 w-64 rounded-full bg-amber-100/25 blur-3xl" />

        <section className="relative overflow-hidden rounded-[2.25rem] border border-slate-200/70 bg-gradient-to-br from-white via-[#F8FBFF] to-[#F2F7FC] shadow-[0_28px_80px_-46px_rgba(15,23,42,0.38)]">
          <div className="absolute inset-y-0 right-0 w-[46%] bg-gradient-to-l from-[#DCEBFA]/55 via-[#EDF5FC]/35 to-transparent" />
          <div className="absolute -right-10 -top-12 opacity-[0.055]">
            <Church className="h-64 w-64 text-[#1F4F7A]" />
          </div>

          <div className="relative z-10 flex flex-col gap-8 px-7 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-3 text-[#2D679B]">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-white shadow-sm">
                  <Landmark className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.32em]">
                  Consola de Administración
                </span>
              </div>

              <h1 className="font-serif text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
                Panel Parroquial
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {nombreParroquia}
                </p>

                {hasPending && (
                  <motion.button
                    type="button"
                    initial={{ scale: 0.94, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    onClick={() => pendingTarget && navigate(pendingTarget)}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-amber-700 shadow-sm transition hover:bg-amber-100"
                  >
                    <AlertCircle className="h-3.5 w-3.5 animate-pulse" />
                    Existen borradores pendientes
                  </motion.button>
                )}
              </div>

              <div className="mt-6 flex items-center gap-3 text-slate-500">
                <div className="h-px w-10 bg-[#C7A23A]" />
                <p className="font-serif text-sm italic">
                  Cada registro custodia una historia de fe.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Button
                variant="outline"
                onClick={updateDashboardData}
                disabled={isSyncing}
                className="h-12 rounded-2xl border-slate-200 bg-white/80 px-5 shadow-sm backdrop-blur hover:bg-white"
              >
                <RefreshCcw
                  className={cn(
                    'mr-2 h-4 w-4 text-slate-400 transition-transform duration-500',
                    isSyncing && 'animate-spin'
                  )}
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                  Actualizar datos
                </span>
              </Button>

            </div>
          </div>
        </section>

        <section className="relative z-20 -mt-1 grid grid-cols-1 gap-5 py-7 sm:grid-cols-2 xl:grid-cols-5">
          {statsCards.map((stat, index) => {
            const Icon = stat.icon;

            return (
              <motion.button
                type="button"
                key={stat.label}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.07 }}
                onClick={() => navigate(stat.route)}
                className={cn(
                  'group relative min-h-[160px] overflow-hidden rounded-[1.9rem] border bg-white p-6 text-left shadow-[0_18px_46px_-32px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_-30px_rgba(15,23,42,0.28)]',
                  stat.border
                )}
              >
                <div className={cn('absolute inset-0 bg-gradient-to-br opacity-70', stat.glow)} />
                <Icon
                  className={cn(
                    'absolute -bottom-5 -right-4 h-28 w-28 opacity-[0.045] transition-transform duration-500 group-hover:scale-110',
                    stat.accent
                  )}
                />

                <div className="relative z-10 flex h-full flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-2xl border border-white/70 shadow-sm',
                        stat.iconBg
                      )}
                    >
                      <Icon className={cn('h-5 w-5', stat.accent)} />
                    </div>

                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-100 bg-white/85 text-slate-300 transition group-hover:border-slate-200 group-hover:text-slate-600">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-3xl font-black tracking-tight text-slate-950">
                      {isSyncing ? (
                        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                      ) : (
                        stat.value
                      )}
                    </p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-xs font-medium text-slate-400">
                      {stat.description}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.92fr_2.08fr]">
          <div className="rounded-[2rem] border border-slate-200/75 bg-white p-6 shadow-[0_20px_55px_-38px_rgba(15,23,42,0.35)]">
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#D2A827]" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-500">
                  Accesos Inmediatos
                </h2>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Gestión rápida del archivo parroquial.
              </p>
            </div>

            <div className="space-y-3">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;

                return (
                  <button
                    type="button"
                    key={action.label}
                    onClick={() => navigate(action.route)}
                    className={cn(
                      'group flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/65 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-slate-200/50',
                      action.hover
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                        action.iconBg
                      )}
                    >
                      <Icon className={cn('h-5 w-5', action.accent)} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-800">
                        {action.label}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-slate-400">
                        {action.description}
                      </p>
                    </div>

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-slate-200/75 bg-white shadow-[0_20px_55px_-38px_rgba(15,23,42,0.35)]">
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-white px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#316B9B]">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                    Actividad Reciente
                  </h3>
                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Últimos registros procesados en la nube
                  </p>
                </div>
              </div>

              {hasPending && pendingTarget && (
                <Button
                  variant="ghost"
                  onClick={() => navigate(pendingTarget)}
                  className="h-9 rounded-xl px-4 text-[9px] font-black uppercase tracking-widest text-[#316B9B] hover:bg-blue-50"
                >
                  Sentar Borradores
                  <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="p-4 md:p-5">
              {isSyncing ? (
                <div className="flex min-h-[330px] items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-200" />
                    <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-300">
                      Actualizando datos
                    </p>
                  </div>
                </div>
              ) : recentRecords.length === 0 ? (
                <div className="flex min-h-[330px] items-center justify-center text-center">
                  <div>
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50">
                      <Activity className="h-7 w-7 text-slate-200" />
                    </div>
                    <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Sin movimientos registrados
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full min-w-[700px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50/90">
                        <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-wider text-slate-500">
                          Titular
                        </th>
                        <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-wider text-slate-500">
                          Sacramento
                        </th>
                        <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-wider text-slate-500">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-wider text-slate-500">
                          Estado
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {recentRecords.map((record) => (
                        <tr
                          key={`${record.sacramento}-${record.id}`}
                          className="border-t border-slate-100 transition hover:bg-[#F8FBFE]"
                        >
                          <td className="px-4 py-4">
                            <p className="text-[11px] font-black uppercase tracking-tight text-slate-900">
                              {record.nombres}
                            </p>
                            {record.apellidos && (
                              <p className="mt-1 text-[9px] font-bold uppercase text-slate-400">
                                {record.apellidos}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <SacramentBadge type={record.sacramento} />
                          </td>

                          <td className="px-4 py-4">
                            <span className="font-mono text-[10px] font-bold text-slate-500">
                              {record.fecha}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <StatusBadge pending={record.isPending} status={record.status} source={record.source} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-blue-200/50 bg-gradient-to-r from-[#2D679B] via-[#3978AE] to-[#4B8BC0] text-white shadow-[0_24px_60px_-38px_rgba(30,64,175,0.65)]">
          <div className="relative flex flex-col gap-6 px-7 py-6 md:flex-row md:items-center md:justify-between">
            <div className="absolute -bottom-16 -right-10 opacity-[0.08]">
              <Church className="h-48 w-48" />
            </div>

            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur">
                <ShieldCheck className="h-6 w-6" />
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-blue-100">
                  Soporte Técnico
                </p>
                <h3 className="mt-1 text-lg font-black">
                  ¿Necesitas ayuda con un decreto, una corrección o una reposición?
                </h3>
                <p className="mt-1 text-xs text-blue-100/90">
                  Consulta las notificaciones de Cancillería y continúa el flujo institucional.
                </p>
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-4">
              <div className="hidden text-right lg:block">
                <p className="font-serif text-sm italic text-blue-50">
                  Al servicio de la Iglesia, siempre.
                </p>
                <div className="ml-auto mt-2 h-px w-12 bg-[#E4C05C]" />
              </div>

              <Button
                type="button"
                onClick={() => navigate('/parish/notifications')}
                className="h-11 rounded-2xl border border-white/20 bg-white px-5 text-[10px] font-black uppercase tracking-widest text-[#285F91] shadow-lg hover:bg-blue-50"
              >
                Ver Cancillería
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

const SacramentBadge = ({ type }) => {
  const styles =
    type === 'Bautismo'
      ? 'border-blue-100 bg-blue-50 text-blue-700'
      : type === 'Confirmación'
        ? 'border-blue-100 bg-blue-50 text-blue-700'
        : 'border-blue-100 bg-blue-50 text-blue-700';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em]',
        styles
      )}
    >
      {type}
    </span>
  );
};

const StatusBadge = ({ pending, status, source }) => {
  const normalizedStatus = String(status || '').toLowerCase();

  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-amber-700">
        <Clock className="h-3 w-3" /> Borrador
      </span>
    );
  }

  if (['anulada', 'annulled'].includes(normalizedStatus)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-red-700">
        <AlertCircle className="h-3 w-3" /> Anulada
      </span>
    );
  }

  if (source === 'legacy_import') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-violet-700">
        <Archive className="h-3 w-3" /> Migrada
      </span>
    );
  }

  if (source === 'historical_book_digitization') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-blue-700">
        <BookOpen className="h-3 w-3" /> Histórica
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-green-700">
      <CheckCircle2 className="h-3 w-3" /> Asentado
    </span>
  );
};

export default ParishDashboard;
