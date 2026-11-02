import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import EcclesialCommandCenter from '@/components/EcclesialCommandCenter';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { purificarRegistroBautismo } from '@/services/sacramentsService';
import { Button } from '@/components/ui/button';
import { Activity, AlertCircle, Clock, CheckCircle2, Loader2, ChevronRight, Archive, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [pendingCount, setPendingCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
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
    setLoadError(false);

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
      setPendingCount(bPending.length + cPending.length + mPending.length + fPending.length);
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
      setLoadError(true);
    } finally {
      setIsSyncing(false);
    }
  }, [currentParishId]);

  useEffect(() => {
    updateDashboardData();
    window.addEventListener('storage', updateDashboardData);

    return () => window.removeEventListener('storage', updateDashboardData);
  }, [updateDashboardData]);

  return (
    <DashboardLayout entityName={nombreParroquia} commandCenter>
      <div className="mx-auto pb-8">
        <EcclesialCommandCenter
          role="parish"
          entityName={nombreParroquia}
          loading={isSyncing}
          error={loadError}
          onRefresh={updateDashboardData}
          metrics={[
            { label: 'Bautismos', value: stats.baptisms, icon: 'droplets', to: '/parroquia/bautismo/partidas' },
            { label: 'Confirmaciones', value: stats.confirmations, icon: 'flame', to: '/parroquia/confirmacion/partidas' },
            { label: 'Matrimonios', value: stats.marriages, icon: 'heart', to: '/parroquia/matrimonio/partidas' },
            { label: 'Exequias', value: stats.funerals, icon: 'cross', to: '/parroquia/exequias/partidas' },
            { label: 'Total de registros', value: stats.total, icon: 'book', to: '/buscar' },
          ]}
          attention={[{
            label: 'Registros pendientes de asiento',
            value: isSyncing || loadError ? '—' : pendingCount,
            icon: 'clock',
            to: pendingTarget || '/parroquia/bautismo/sentar-registros',
          }]}
        />
        <section aria-label="Actividad reciente del despacho">
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
                  Asentar registros pendientes
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
        <Clock className="h-3 w-3" /> Pendiente de asiento
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
