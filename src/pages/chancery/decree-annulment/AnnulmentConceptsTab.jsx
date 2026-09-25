import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/use-toast';
import { Search, Edit, PowerOff, Plus, Loader2, Save } from 'lucide-react';
import Table from '@/components/ui/Table';
import { supabase } from '@/lib/supabaseClient';
import { institutionalConfirm } from '@/lib/institutionalDialog';

const EMPTY = {
  id: null,
  codigo: '',
  concepto: '',
  expide: 'CANCILLERÍA',
  tipo: 'porCorreccion'
};

const typeLabel = (tipo) => {
  if (tipo === 'porCorreccion') return 'Corrección';
  if (tipo === 'porReposicion') return 'Reposición';
  if (tipo === 'porRepeticion') return 'Repetición / histórico';
  return 'Otro';
};

const typeBadge = (tipo) => {
  if (tipo === 'porCorreccion') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (tipo === 'porReposicion') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (tipo === 'porRepeticion') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const AnnulmentConceptsTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [concepts, setConcepts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dioceseId, setDioceseId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const resolveDiocese = async () => {
    let targetDioceseId = user?.dioceseId || user?.diocese_id;

    if (!targetDioceseId && (user?.chanceryId || user?.chancery_id)) {
      const { data, error } = await supabase
        .from('chancelleries')
        .select('diocese_id')
        .eq('id', user.chanceryId || user.chancery_id)
        .maybeSingle();

      if (error) throw error;
      targetDioceseId = data?.diocese_id || null;
    }

    if (!targetDioceseId) {
      throw new Error('No se pudo determinar la Diócesis de la Cancillería.');
    }

    return targetDioceseId;
  };

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const targetDioceseId = await resolveDiocese();
      setDioceseId(targetDioceseId);

      const { data, error } = await supabase
        .from('conceptos_anulacion')
        .select('id,codigo,concepto,expide,tipo,created_at,diocese_id,is_active')
        .eq('diocese_id', targetDioceseId)
        .eq('is_active', true)
        .order('codigo', { ascending: true });

      if (error) throw error;

      setConcepts(
        (data || []).filter((row) => String(row.tipo || '') !== 'porNulidad')
      );
    } catch (error) {
      console.error('Error loading decree concepts:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudieron cargar los conceptos de decreto.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const filteredConcepts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return concepts
      .filter((row) => {
        if (!term) return true;
        return [row.codigo, row.concepto, typeLabel(row.tipo)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) =>
        String(a.codigo || '').localeCompare(String(b.codigo || ''), undefined, {
          numeric: true
        })
      );
  }, [concepts, searchTerm]);

  const openCreate = () => {
    setForm({ ...EMPTY });
    setModalOpen(true);
  };

  const openEdit = (row, event) => {
    event?.stopPropagation();
    setForm({
      id: row.id,
      codigo: row.codigo || '',
      concepto: row.concepto || '',
      expide: row.expide || 'CANCILLERÍA',
      tipo:
        row.tipo === 'porReposicion' || row.tipo === 'porRepeticion'
          ? row.tipo
          : 'porCorreccion'
    });
    setModalOpen(true);
  };

  const saveConcept = async (event) => {
    event.preventDefault();

    if (!dioceseId) {
      toast({
        title: 'Diócesis no disponible',
        description: 'No se puede guardar el concepto sin jurisdicción diocesana.',
        variant: 'destructive'
      });
      return;
    }

    if (!form.codigo.trim() || !form.concepto.trim()) {
      toast({
        title: 'Datos incompletos',
        description: 'Código y concepto son obligatorios.',
        variant: 'destructive'
      });
      return;
    }

    if (form.tipo === 'porNulidad') {
      toast({
        title: 'Tipo no permitido',
        description: 'La nulidad matrimonial pertenece al Tribunal Eclesiástico.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        codigo: form.codigo.trim().toUpperCase(),
        concepto: form.concepto.trim().toUpperCase(),
        expide: (form.expide || 'CANCILLERÍA').trim().toUpperCase(),
        tipo: form.tipo,
        diocese_id: dioceseId,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      if (form.id) {
        const { error } = await supabase
          .from('conceptos_anulacion')
          .update(payload)
          .eq('id', form.id)
          .eq('diocese_id', dioceseId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('conceptos_anulacion')
          .insert(payload);

        if (error) throw error;
      }

      toast({
        title: form.id ? 'Concepto actualizado' : 'Concepto creado',
        description: 'El catálogo diocesano quedó sincronizado.',
        className: 'bg-green-50 border-green-200 text-green-900'
      });

      setModalOpen(false);
      setForm({ ...EMPTY });
      await loadData();
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id, event) => {
    event?.stopPropagation();

    if (!(await institutionalConfirm({
      title: 'Desactivar concepto de decreto',
      message: 'No se borrará el historial ni los decretos que ya utilizan este concepto.',
      confirmText: 'Sí, desactivar',
      tone: 'warning'
    }))) {
      return;
    }

    try {
      const { error } = await supabase
        .from('conceptos_anulacion')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('diocese_id', dioceseId);

      if (error) throw error;

      toast({
        title: 'Concepto desactivado',
        description:
          'Ya no estará disponible para nuevos decretos; el historial permanece intacto.',
        className: 'bg-green-50 border-green-200 text-green-900'
      });

      await loadData();
    } catch (error) {
      toast({
        title: 'No se pudo desactivar',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const columns = [
    {
      header: 'Código',
      render: (row) => (
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-xs font-black text-slate-600">
          {row.codigo}
        </span>
      )
    },
    {
      header: 'Concepto',
      render: (row) => (
        <span className="text-xs font-bold uppercase tracking-tight text-slate-900">
          {row.concepto}
        </span>
      )
    },
    {
      header: 'Expide',
      render: (row) => (
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {row.expide}
        </span>
      )
    },
    {
      header: 'Uso',
      render: (row) => (
        <span
          className={`rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${typeBadge(
            row.tipo
          )}`}
        >
          {typeLabel(row.tipo)}
        </span>
      )
    },
    {
      header: 'Acciones',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl text-blue-700 hover:bg-blue-50"
            onClick={(event) => openEdit(row, event)}
            title="Editar"
          >
            <Edit className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl text-red-500 hover:bg-red-50"
            onClick={(event) => deactivate(row.id, event)}
            title="Desactivar sin borrar historial"
          >
            <PowerOff className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <>
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-12 pl-12"
              placeholder="Buscar por código, concepto o uso..."
            />
          </div>

          <Button
            onClick={openCreate}
            className="h-12 w-full bg-slate-900 px-7 font-black text-white hover:bg-slate-800 md:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo concepto
          </Button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="py-20 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : filteredConcepts.length ? (
            <Table columns={columns} data={filteredConcepts} />
          ) : (
            <div className="py-20 text-center text-sm text-slate-400">
              No hay conceptos activos de Corrección o Reposición.
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={form.id ? 'Editar concepto de decreto' : 'Nuevo concepto de decreto'}
      >
        <form onSubmit={saveConcept} className="space-y-5 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                Código
              </label>
              <Input
                value={form.codigo}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    codigo: event.target.value.toUpperCase()
                  }))
                }
                placeholder="Ej. COR-01"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                Uso
              </label>
              <select
                value={form.tipo}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tipo: event.target.value
                  }))
                }
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold"
              >
                <option value="porCorreccion">Corrección</option>
                <option value="porReposicion">Reposición</option>
                <option value="porRepeticion">Repetición / histórico</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Concepto / causa
            </label>
            <textarea
              value={form.concepto}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  concepto: event.target.value.toUpperCase()
                }))
              }
              className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold"
              placeholder="Describa el concepto estandarizado..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Expide
            </label>
            <Input
              value={form.expide}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  expide: event.target.value.toUpperCase()
                }))
              }
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default AnnulmentConceptsTab;
