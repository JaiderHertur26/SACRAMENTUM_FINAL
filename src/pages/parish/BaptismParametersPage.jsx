import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  Save,
  RefreshCw,
  Settings,
  BookOpen,
  CheckSquare,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { getDefaultBaptismParameters, saveBaptismParameters } from '@/services/sacramentParametersService';
import {
  getFuneralParametersCloud,
  saveFuneralParametersCloud
} from '@/services/funeralService';
import { institutionalConfirm } from '@/lib/institutionalDialog';

const DEFAULT_BAPTISM_PARAMS = getDefaultBaptismParameters();

const DEFAULT_FUNERAL_PARAMS = {
  ordinarioBlocked: false,
  ordinarioRestartNumber: false,
  ordinarioPartidas: 2,
  ordinarioLibro: 1,
  ordinarioFolio: 1,
  ordinarioNumero: 1,
  numeroRegistroActual: '000000',
  suplementarioBlocked: false,
  suplementarioReiniciar: false,
  suplementarioPartidas: 2,
  suplementarioLibro: 1,
  suplementarioFolio: 1,
  suplementarioNumero: 1,
  registroInscripcionEn: 'ordinario',
  registroDecretoEn: 'suplementario',
  generarNotaMarginal: true,
  enablePreview: true,
  reportPrinting: false
};

const DEFAULT_LOCAL_PREFS = {
  enablePreview: true,
  reportPrinting: false
};

const normalTab =
  'px-6 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 whitespace-nowrap rounded-t-md';

const activeTab =
  'px-6 py-2 text-sm font-bold text-[#4B7BA7] border-b-2 border-[#4B7BA7] bg-white rounded-t-md whitespace-nowrap';

const BaptismParametersPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();

  const isFuneral =
    location.pathname.includes('/exequias/parametros') ||
    new URLSearchParams(location.search).get('tab') === 'exequias';

  const [cloudParams, setCloudParams] = useState(
    isFuneral ? DEFAULT_FUNERAL_PARAMS : DEFAULT_BAPTISM_PARAMS
  );
  const [localPrefs, setLocalPrefs] = useState(DEFAULT_LOCAL_PREFS);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [baptismBaseline, setBaptismBaseline] = useState(null);

  const parishId = user?.parishId || user?.parish_id || null;

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      if (!parishId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        if (isFuneral) {
          const remote = await getFuneralParametersCloud(parishId);
          if (cancelled) return;

          const merged = {
            ...DEFAULT_FUNERAL_PARAMS,
            ...(remote || {})
          };

          setCloudParams(merged);
          setLocalPrefs({
            enablePreview:
              typeof merged.enablePreview === 'boolean'
                ? merged.enablePreview
                : true,
            reportPrinting:
              typeof merged.reportPrinting === 'boolean'
                ? merged.reportPrinting
                : false
          });
        } else {
          const savedPrefs = localStorage.getItem('bautizos_ui_prefs');

          if (savedPrefs) {
            try {
              setLocalPrefs({
                ...DEFAULT_LOCAL_PREFS,
                ...JSON.parse(savedPrefs)
              });
            } catch {
              setLocalPrefs(DEFAULT_LOCAL_PREFS);
            }
          } else {
            setLocalPrefs(DEFAULT_LOCAL_PREFS);
          }

          const { data, error } = await supabase
            .from('parish_parameters')
            .select('bautizos_params')
            .eq('parish_id', parishId)
            .maybeSingle();

          if (error && error.code !== 'PGRST116') throw error;
          if (cancelled) return;

          const resolved = {
            ...DEFAULT_BAPTISM_PARAMS,
            ...(data?.bautizos_params || {})
          };
          setCloudParams(resolved);
          setBaptismBaseline(resolved);
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: 'Error de Sincronización',
            description:
              error?.message ||
              'No se pudieron descargar los parámetros desde la nube.',
            variant: 'destructive'
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [isFuneral, parishId, toast]);

  const handleCloudChange = (e) => {
    const { name, value, type, checked } = e.target;

    setCloudParams((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleLocalPrefChange = (e) => {
    const { name, checked } = e.target;
    const next = { ...localPrefs, [name]: checked };
    setLocalPrefs(next);

    if (!isFuneral) {
      localStorage.setItem('bautizos_ui_prefs', JSON.stringify(next));
    }
  };

  const handleSaveParameters = async () => {
    if (!parishId) return;

    setIsSaving(true);

    try {
      if (isFuneral) {
        const payload = {
          ...cloudParams,
          enablePreview: Boolean(localPrefs.enablePreview),
          reportPrinting: Boolean(localPrefs.reportPrinting),
          ordinarioLibro: Number(cloudParams.ordinarioLibro),
          ordinarioFolio: Number(cloudParams.ordinarioFolio),
          ordinarioNumero: Number(cloudParams.ordinarioNumero),
          ordinarioPartidas: Number(cloudParams.ordinarioPartidas),
          suplementarioLibro: Number(cloudParams.suplementarioLibro),
          suplementarioFolio: Number(cloudParams.suplementarioFolio),
          suplementarioNumero: Number(cloudParams.suplementarioNumero),
          suplementarioPartidas: Number(cloudParams.suplementarioPartidas)
        };

        const saved = await saveFuneralParametersCloud({
          parishId,
          params: payload
        });

        setCloudParams({
          ...DEFAULT_FUNERAL_PARAMS,
          ...(saved || payload)
        });

        toast({
          title: 'Exequias sincronizadas',
          description:
            'Los parámetros y consecutivos de Exequias quedaron guardados en la nube.',
          className: 'bg-green-50 border-green-200 text-green-900'
        });
      } else {
        if (!baptismBaseline) throw new Error('Recargue los parámetros antes de guardar cambios.');
        const payload = {
          ...cloudParams,
          ordinarioLibro: Number(cloudParams.ordinarioLibro),
          ordinarioFolio: Number(cloudParams.ordinarioFolio),
          ordinarioNumero: Number(cloudParams.ordinarioNumero),
          ordinarioPartidas: Number(cloudParams.ordinarioPartidas),
          suplementarioLibro: Number(cloudParams.suplementarioLibro),
          suplementarioFolio: Number(cloudParams.suplementarioFolio),
          suplementarioNumero: Number(cloudParams.suplementarioNumero),
          suplementarioPartidas: Number(cloudParams.suplementarioPartidas)
        };

        const result = await saveBaptismParameters(payload, parishId, baptismBaseline);
        if (!result?.success) throw new Error(result?.message || 'No fue posible guardar los parámetros de Bautismo.');
        const saved = { ...DEFAULT_BAPTISM_PARAMS, ...(result.data || payload) };
        setCloudParams(saved);
        setBaptismBaseline(saved);

        toast({
          title: 'Parámetros protegidos y sincronizados',
          description: 'Supabase confirmó los consecutivos ordinarios y supletorios sin sobrescribir cambios concurrentes.',
          className: 'bg-green-50 border-green-200 text-green-900'
        });
      }
    } catch (error) {
      toast({
        title: 'Error al guardar',
        description:
          error?.message ||
          'No se pudo sincronizar con la base de datos central.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetParameters = async () => {
    if (!isFuneral) {
      if (!(await institutionalConfirm({
        title: 'Restaurar preferencias de Bautismo',
        message: 'Se restaurarán únicamente las preferencias de vista previa e informe de impresión de este ordenador. Libro, Folio, Número, Nº de Registro y consecutivos supletorios permanecerán intactos.',
        confirmText: 'Sí, restaurar preferencias',
        tone: 'warning'
      }))) return;

      setLocalPrefs(DEFAULT_LOCAL_PREFS);
      localStorage.setItem('bautizos_ui_prefs', JSON.stringify(DEFAULT_LOCAL_PREFS));
      toast({
        title: 'Preferencias restauradas',
        description: 'Los consecutivos oficiales de Bautismo no fueron modificados.'
      });
      return;
    }

    if (!(await institutionalConfirm({
      title: 'Restaurar parámetros de Exequias',
      message: '¿Restaurar en pantalla los valores iniciales de Exequias? No se aplicarán hasta pulsar Guardar en la Nube.',
      confirmText: 'Sí, restaurar en pantalla',
      tone: 'warning'
    }))) return;

    setCloudParams(DEFAULT_FUNERAL_PARAMS);
    setLocalPrefs(DEFAULT_LOCAL_PREFS);
    toast({
      title: 'Parámetros Reiniciados',
      description: 'Se han restaurado los valores de Exequias en pantalla. Revise antes de guardar.'
    });
  };

  if (loading) {
    return (
      <DashboardLayout entityName={user?.parishName || 'Parroquia'}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-[#4B7BA7]" />
            <p className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">
              Descargando Consecutivos...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const primaryRuleName = isFuneral
    ? 'registroInscripcionEn'
    : 'registroAdultoEn';

  const primaryRuleValue =
    cloudParams[primaryRuleName] || 'ordinario';

  return (
    <DashboardLayout entityName={user?.parishName || 'Parroquia'}>
      <div className="mx-auto max-w-6xl pb-12">
      <div className="mb-7">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4B7BA7] text-white shadow-lg">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#4B7BA7]">Configuración Parroquial</p>
            <h1 className="font-serif text-3xl font-black text-slate-950">{isFuneral ? 'Parámetros de Exequias' : 'Parámetros de Bautismo'}</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {isFuneral
            ? 'Configure la numeración de libros, folios y reglas documentales para los registros de Exequias.'
            : 'Configure la numeración de libros, folios y opciones generales para las partidas de Bautismo.'}
        </p>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        <Link
          to="/parroquia/bautismo/parametros"
          className={isFuneral ? normalTab : activeTab}
        >
          Bautizos
        </Link>

        <Link
          to="/parroquia/matrimonio/parametros"
          className={normalTab}
        >
          Matrimonios
        </Link>

        <Link
          to="/parroquia/confirmacion/parametros"
          className={normalTab}
        >
          Confirmaciones
        </Link>

        <Link
          to="/parroquia/bautismo/parametros?tab=exequias"
          className={isFuneral ? activeTab : normalTab}
        >
          Exequias
        </Link>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white text-sm shadow-sm">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-[#4B7BA7]" />
            Preferencias {isFuneral ? 'de Impresión' : 'de este Ordenador'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                name="enablePreview"
                checked={Boolean(localPrefs.enablePreview)}
                onChange={handleLocalPrefChange}
                className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded focus:ring-[#4B7BA7]"
              />
              <span className="text-slate-700 font-medium">
                Activar Vista Previa al imprimir
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                name="reportPrinting"
                checked={Boolean(localPrefs.reportPrinting)}
                onChange={handleLocalPrefChange}
                className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded focus:ring-[#4B7BA7]"
              />
              <span className="text-slate-700 font-medium">
                Reportar Impresión de Partidas
              </span>
            </label>
          </div>
        </div>

        <div className="p-4 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between mb-3">
            <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#4B7BA7]" />
              Consecutivos Libro Ordinario
            </h3>
          </div>

          <div className="flex flex-wrap gap-6 mb-4">
            <CheckInput
              name="ordinarioBlocked"
              checked={Boolean(cloudParams.ordinarioBlocked)}
              onChange={handleCloudChange}
              label="Bloquear"
              tone="red"
            />

            <CheckInput
              name="ordinarioRestartNumber"
              checked={Boolean(cloudParams.ordinarioRestartNumber)}
              onChange={handleCloudChange}
              disabled={Boolean(cloudParams.ordinarioBlocked)}
              label="Número inicia en 1 en cada Folio"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <NumberBox
              label="Partidas/Folio"
              name="ordinarioPartidas"
              value={cloudParams.ordinarioPartidas}
              onChange={handleCloudChange}
              disabled={cloudParams.ordinarioBlocked}
            />

            <NumberBox
              label="Libro"
              name="ordinarioLibro"
              value={cloudParams.ordinarioLibro}
              onChange={handleCloudChange}
              disabled={cloudParams.ordinarioBlocked}
              accent="blue"
            />

            <NumberBox
              label="Folio"
              name="ordinarioFolio"
              value={cloudParams.ordinarioFolio}
              onChange={handleCloudChange}
              disabled={cloudParams.ordinarioBlocked}
              accent="blue"
            />

            <NumberBox
              label="Número"
              name="ordinarioNumero"
              value={cloudParams.ordinarioNumero}
              onChange={handleCloudChange}
              disabled={cloudParams.ordinarioBlocked}
              accent="green"
            />

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                Núm. Registro
              </label>
              <input
                type="text"
                name="numeroRegistroActual"
                value={cloudParams.numeroRegistroActual || ''}
                onChange={handleCloudChange}
                readOnly={isFuneral}
                disabled={!isFuneral && cloudParams.ordinarioBlocked}
                className={[
                  'w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold outline-none',
                  isFuneral
                    ? 'bg-blue-50 text-blue-700 cursor-not-allowed'
                    : 'text-slate-800 focus:ring-2 focus:ring-[#4B7BA7] disabled:bg-slate-50'
                ].join(' ')}
              />
              {isFuneral && (
                <p className="mt-1 text-[9px] text-blue-600">
                  Sólo lectura · controlado por el sistema
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#B38F1F]" />
              Consecutivos Supletorios
            </h3>
          </div>

          <div className="flex flex-wrap gap-6 mb-4">
            <CheckInput
              name="suplementarioBlocked"
              checked={Boolean(cloudParams.suplementarioBlocked)}
              onChange={handleCloudChange}
              label="Bloquear"
              tone="red"
            />

            <CheckInput
              name="suplementarioReiniciar"
              checked={Boolean(cloudParams.suplementarioReiniciar)}
              onChange={handleCloudChange}
              disabled={Boolean(cloudParams.suplementarioBlocked)}
              label="Reiniciar Número desde 1 en cada folio"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <NumberBox
              label="Partidas/Folio"
              name="suplementarioPartidas"
              value={cloudParams.suplementarioPartidas}
              onChange={handleCloudChange}
              disabled={cloudParams.suplementarioBlocked}
            />

            <NumberBox
              label="Libro"
              name="suplementarioLibro"
              value={cloudParams.suplementarioLibro}
              onChange={handleCloudChange}
              disabled={cloudParams.suplementarioBlocked}
              accent="purple"
            />

            <NumberBox
              label="Folio"
              name="suplementarioFolio"
              value={cloudParams.suplementarioFolio}
              onChange={handleCloudChange}
              disabled={cloudParams.suplementarioBlocked}
              accent="purple"
            />

            <NumberBox
              label="Número"
              name="suplementarioNumero"
              value={cloudParams.suplementarioNumero}
              onChange={handleCloudChange}
              disabled={cloudParams.suplementarioBlocked}
              accent="purple"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/30">
          <RuleBox
            title={
              isFuneral
                ? 'Destino Inscripción Regular:'
                : 'Destino Bautizos de Adulto:'
            }
            name={primaryRuleName}
            value={primaryRuleValue}
            onChange={handleCloudChange}
          />

          <RuleBox
            title="Destino Inscripción por Decreto:"
            name="registroDecretoEn"
            value={cloudParams.registroDecretoEn || 'suplementario'}
            onChange={handleCloudChange}
          />
        </div>

        <div className="p-6 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Notas Marginales
          </h3>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              name="generarNotaMarginal"
              checked={Boolean(cloudParams.generarNotaMarginal)}
              onChange={handleCloudChange}
              className="w-4 h-4 text-[#4B7BA7] border-slate-300 rounded focus:ring-[#4B7BA7]"
            />
            <span className="text-slate-700 font-medium text-sm">
              {isFuneral
                ? 'Generar nota marginal cuando el flujo documental de Exequias lo requiera'
                : 'Generar nota marginal de Registro Civil al imprimir el libro'}
            </span>
          </label>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleResetParameters}
            disabled={isSaving}
            className="text-slate-600 border-slate-300 hover:bg-slate-200 rounded-xl px-6 font-bold uppercase tracking-widest text-[10px]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {isFuneral ? 'Restaurar Valores' : 'Restaurar Preferencias'}
          </Button>

          <Button
            type="button"
            onClick={handleSaveParameters}
            disabled={isSaving}
            className="rounded-xl px-8 font-black uppercase tracking-widest text-[10px]"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isSaving ? 'Sincronizando...' : 'Guardar en la Nube'}
          </Button>
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
};

const CheckInput = ({
  name,
  checked,
  onChange,
  label,
  disabled = false,
  tone = 'blue'
}) => (
  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
    <input
      type="checkbox"
      name={name}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className={[
        'w-4 h-4 border-slate-300 rounded disabled:opacity-50',
        tone === 'red'
          ? 'text-red-500 focus:ring-red-500'
          : 'text-[#4B7BA7] focus:ring-[#4B7BA7]'
      ].join(' ')}
    />
    {label}
  </label>
);

const NumberBox = ({
  label,
  name,
  value,
  onChange,
  disabled = false,
  accent = 'default'
}) => {
  const accentClass =
    accent === 'green'
      ? 'font-black text-green-600 bg-green-50 focus:ring-green-500'
      : accent === 'purple'
      ? 'font-mono font-bold text-[#B38F1F] bg-amber-50/50 focus:ring-[#D4AF37]/30'
      : accent === 'blue'
      ? 'font-mono font-bold text-blue-600 focus:ring-[#4B7BA7]'
      : 'font-bold text-slate-800 focus:ring-[#4B7BA7]';

  return (
    <div>
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
        {label}
      </label>
      <input
        type="number"
        min="1"
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 disabled:bg-slate-50 ${accentClass}`}
      />
    </div>
  );
};

const RuleBox = ({ title, name, value, onChange }) => (
  <div className="p-6">
    <h4 className="font-bold text-slate-800 mb-3 text-[11px] uppercase tracking-widest">
      {title}
    </h4>

    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="radio"
          name={name}
          value="ordinario"
          checked={value === 'ordinario'}
          onChange={onChange}
          className="w-4 h-4 text-[#4B7BA7] focus:ring-[#4B7BA7]"
        />
        <span className="text-slate-700 text-sm font-medium">
          Libro Ordinario
        </span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="radio"
          name={name}
          value="suplementario"
          checked={value === 'suplementario'}
          onChange={onChange}
          className="w-4 h-4 text-[#4B7BA7] focus:ring-[#4B7BA7]"
        />
        <span className="text-slate-700 text-sm font-medium">
          Libro Supletorio
        </span>
      </label>
    </div>
  </div>
);

export default BaptismParametersPage;
