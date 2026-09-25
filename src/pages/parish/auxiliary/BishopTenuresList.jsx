import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import AuxiliaryAutocomplete from '@/components/AuxiliaryAutocomplete';
import { supabase } from '@/lib/supabaseClient';
import { institutionalConfirm } from '@/lib/institutionalDialog';

const emptyForm = {
  bishop_name: '',
  bishop_id: null,
  start_date: '',
  end_date: '',
  notes: ''
};

const BishopTenuresList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const parishId = user?.parish_id || user?.parishId || null;

  const [items,setItems] = useState([]);
  const [bishops,setBishops] = useState([]);
  const [loading,setLoading] = useState(true);
  const [modalOpen,setModalOpen] = useState(false);
  const [editing,setEditing] = useState(null);
  const [form,setForm] = useState(emptyForm);

  const bishopOptions = useMemo(
    () => bishops
      .map((b) => `${b.nombre || ''} ${b.apellido || ''}`.trim().toUpperCase())
      .filter(Boolean),
    [bishops]
  );

  const load = async () => {
    if(!parishId) return;
    setLoading(true);
    try {
      const [tenuresRes,bishopsRes] = await Promise.all([
        supabase
          .from('bishop_tenures')
          .select('*')
          .eq('parish_id',parishId)
          .order('start_date',{ascending:false}),
        supabase
          .from('obispos')
          .select('*')
          .eq('parish_id',parishId)
          .order('nombre')
      ]);
      if(tenuresRes.error) throw tenuresRes.error;
      if(bishopsRes.error) throw bishopsRes.error;
      setItems(tenuresRes.data || []);
      setBishops(bishopsRes.data || []);
    } catch(error) {
      toast({
        title:'No se pudo cargar',
        description:error.message,
        variant:'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ load(); },[parishId]);

  const openNew=()=>{
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit=(item)=>{
    setEditing(item);
    setForm({
      bishop_name:item.bishop_name || '',
      bishop_id:item.bishop_id || null,
      start_date:item.start_date || '',
      end_date:item.end_date || '',
      notes:item.notes || ''
    });
    setModalOpen(true);
  };

  const onBishopChange=(e)=>{
    const name=String(e.target.value || '').toUpperCase();
    const match=bishops.find((b)=>
      `${b.nombre || ''} ${b.apellido || ''}`.trim().toUpperCase()===name
    );
    setForm((prev)=>({
      ...prev,
      bishop_name:name,
      bishop_id:match?.id || null
    }));
  };

  const save=async()=>{
    if(!parishId || !form.bishop_name.trim() || !form.start_date) {
      toast({
        title:'Datos incompletos',
        description:'Obispo titular y fecha de inicio son obligatorios.',
        variant:'destructive'
      });
      return;
    }
    if(form.end_date && form.end_date<form.start_date) {
      toast({
        title:'Fechas inconsistentes',
        description:'La fecha final no puede ser anterior al inicio.',
        variant:'destructive'
      });
      return;
    }

    const payload={
      parish_id:parishId,
      bishop_id:form.bishop_id || null,
      bishop_name:form.bishop_name.trim().toUpperCase(),
      start_date:form.start_date,
      end_date:form.end_date || null,
      notes:form.notes || null
    };

    const result=editing
      ? await supabase.from('bishop_tenures').update(payload).eq('id',editing.id).eq('parish_id',parishId)
      : await supabase.from('bishop_tenures').insert(payload);

    if(result.error) {
      toast({
        title:'No se pudo guardar',
        description:result.error.message,
        variant:'destructive'
      });
      return;
    }

    toast({
      title:editing ? 'Periodo actualizado' : 'Obispo titular registrado',
      description:'El motor histórico ya puede resolver este periodo.',
      className:'bg-green-50 border-green-200 text-green-900'
    });
    setModalOpen(false);
    await load();
  };

  const remove=async(item)=>{
    const ok=await institutionalConfirm({
      title:'Eliminar periodo episcopal',
      message:'Se eliminará este periodo del historial de Obispos Titulares.',
      confirmText:'Sí, eliminar',
      tone:'destructive'
    });
    if(!ok) return;
    const { error }=await supabase
      .from('bishop_tenures')
      .delete()
      .eq('id',item.id)
      .eq('parish_id',parishId);
    if(error) {
      toast({title:'No se pudo eliminar',description:error.message,variant:'destructive'});
      return;
    }
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-[#4B7BA7]" />
            Historial de Obispos Titulares
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Define quién era el Obispo titular en cada periodo. Es independiente del directorio general de Obispos.
          </p>
        </div>
        <Button onClick={openNew} className="bg-[#4B7BA7] text-white hover:bg-[#3A6286]">
          <Plus className="w-4 h-4 mr-2" /> Agregar periodo
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#D4AF37] text-slate-900 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Acciones</th>
              <th className="px-4 py-3 text-left">Obispo titular</th>
              <th className="px-4 py-3 text-left">Desde</th>
              <th className="px-4 py-3 text-left">Hasta</th>
              <th className="px-4 py-3 text-left">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="5" className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#4B7BA7]" /></td></tr>
            ) : items.length===0 ? (
              <tr><td colSpan="5" className="py-12 text-center text-slate-500 italic">No hay periodos episcopales registrados.</td></tr>
            ) : items.map((item)=>(
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button type="button" onClick={()=>openEdit(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={()=>remove(item)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 font-bold text-slate-900">{item.bishop_name}</td>
                <td className="px-4 py-3">{item.start_date}</td>
                <td className="px-4 py-3">{item.end_date || 'ACTUAL / SIN FECHA FINAL'}</td>
                <td className="px-4 py-3 text-slate-500">{item.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={()=>setModalOpen(false)}
        title={editing ? 'Editar periodo de Obispo titular' : 'Nuevo periodo de Obispo titular'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Obispo titular *</label>
            <AuxiliaryAutocomplete
              name="bishop_name"
              value={form.bishop_name}
              onChange={onBishopChange}
              options={bishopOptions}
              placeholder="EMPIECE A ESCRIBIR EL NOMBRE DEL OBISPO..."
              className="w-full h-10 px-3 border border-slate-300 rounded-xl uppercase"
            />
            <p className="mt-1 text-xs text-slate-500">
              Puede escoger del directorio general de Obispos o escribir el nombre si aún no está catalogado.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Inicio del periodo *</label>
              <Input type="date" value={form.start_date} onChange={(e)=>setForm({...form,start_date:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Fin del periodo</label>
              <Input type="date" value={form.end_date} onChange={(e)=>setForm({...form,end_date:e.target.value})} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Observaciones</label>
            <textarea
              value={form.notes}
              onChange={(e)=>setForm({...form,notes:e.target.value})}
              className="w-full min-h-24 border border-slate-300 rounded-xl p-3"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={()=>setModalOpen(false)}>Cancelar</Button>
            <Button onClick={save} className="bg-[#4B7BA7] text-white">Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BishopTenuresList;
