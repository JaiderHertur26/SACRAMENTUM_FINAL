import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Save, Building2, MapPin, Church, Loader2, Link2 } from 'lucide-react';
import { loadMisDatosAutofillContext, mergeChurchIntoMisDatos } from '@/services/misDatosAutofillService';

const EMPTY_FORM = {
  iglesia_id: '', idcod: '', nombre: '', nronit: '', region: '', direccion: '',
  ciudad: '', telefono: '', nrofax: '', email: '', parroco: '', vicaria: '',
  decanato: '', diocesis: '', obispo: '', obispoAuxiliar: '', canciller: '', viceCanciller: '', serial: '', ruta: ''
};

const labelClass = 'text-[9px] font-black text-slate-500 uppercase ml-1';
const linkedClass = 'bg-slate-100 text-slate-700 font-bold cursor-not-allowed';

const ManualMisDatosModal = ({ isOpen, onClose, onSave }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const parishId = user?.parishId || user?.parish_id || null;
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [context, setContext] = useState({ defaults: {}, churches: [], parish: null });
  const [loadingContext, setLoadingContext] = useState(false);

  useEffect(() => {
    if (!isOpen || !parishId) return;
    let active = true;
    setLoadingContext(true);
    loadMisDatosAutofillContext(parishId)
      .then((result) => {
        if (!active) return;
        setContext(result);
        setFormData({ ...EMPTY_FORM, ...(result.defaults || {}) });
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: 'No fue posible autocompletar Mis Datos',
          description: error?.message || 'Revise la configuración institucional de la parroquia.',
          variant: 'destructive'
        });
      })
      .finally(() => active && setLoadingContext(false));

    return () => { active = false; };
  }, [isOpen, parishId, toast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const finalValue = name === 'email' ? value.toLowerCase() : value.toUpperCase();
    setFormData((prev) => ({ ...prev, [name]: finalValue }));
  };

  const handleChurchChange = (e) => {
    const churchId = e.target.value;
    if (!churchId) {
      setFormData((prev) => ({ ...prev, ...context.defaults, iglesia_id: '' }));
      return;
    }
    const church = context.churches.find((item) => String(item.iglesia_id) === String(churchId));
    if (!church) return;
    setFormData((prev) => mergeChurchIntoMisDatos(prev, church, context.defaults));
  };

  const handleSave = () => {
    if (!formData.nombre?.trim()) {
      toast({ title: 'Atención', description: 'El nombre de la entidad es obligatorio.', variant: 'destructive' });
      return;
    }
    onSave({ ...formData, isManual: true, institutionalLink: true });
  };
  return (
    <Modal size="xl" isOpen={isOpen} onClose={onClose} title="Cargar Registro · Mis Datos">
      <div className="relative space-y-8 pb-6 w-full">
        {loadingContext && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-white/85">
            <div className="text-center">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#4B7BA7]" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vinculando datos institucionales...</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900">
          <div className="flex gap-3">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p><strong>Registro vinculado.</strong> El nombre se toma de la parroquia o de <strong>Datos Auxiliares → Iglesias</strong>.
              La jurisdicción, vicaría, decanato y autoridades se resuelven desde la estructura oficial de la parroquia.</p>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Building2 className="h-4 w-4 text-[#4B7BA7]" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Identidad institucional</h4>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-1">
              <label className={labelClass}>ID Código</label>
              <Input name="idcod" value={formData.idcod || ''} onChange={handleChange} className="bg-slate-50/50 font-mono" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className={labelClass}>Nombre Oficial / Iglesia vinculada *</label>
              <select value={formData.iglesia_id || ''} onChange={handleChurchChange}
                className="w-full rounded-xl border border-l-4 border-l-[#4B7BA7] bg-white px-3 py-3 text-sm font-bold uppercase">
                <option value="">{context.defaults?.nombre || context.parish?.name || 'PARROQUIA ACTUAL'}</option>
                {context.churches.map((church) => (
                  <option key={church.iglesia_id} value={church.iglesia_id}>{church.nombre}</option>
                ))}
              </select>
              <p className="ml-1 text-[10px] font-semibold text-slate-500">{formData.nombre || '—'}</p>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>NIT / Identificación</label>
              <Input name="nronit" value={formData.nronit || ''} onChange={handleChange} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Teléfono</label>
              <Input name="telefono" value={formData.telefono || ''} onChange={handleChange} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Email</label>
              <Input name="email" value={formData.email || ''} onChange={handleChange} type="email" className="lowercase" />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Fax</label>
              <Input name="nrofax" value={formData.nrofax || ''} onChange={handleChange} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className={labelClass}>Párroco actual</label>
              <Input name="parroco" value={formData.parroco || ''} onChange={handleChange} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <MapPin className="h-4 w-4 text-[#D4AF37]" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ubicación</h4>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className={labelClass}>Dirección física</label>
              <Input name="direccion" value={formData.direccion || ''} onChange={handleChange} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Ciudad / Municipio</label>
              <Input name="ciudad" value={formData.ciudad || ''} onChange={handleChange} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Región / Provincia eclesiástica</label>
              <Input name="region" value={formData.region || ''} onChange={handleChange} />
            </div>
          </div>
        </section>
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Church className="h-4 w-4 text-[#4B7BA7]" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Jerarquía eclesiástica vinculada</h4>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              ['diocesis','Diócesis / Arquidiócesis'],
              ['vicaria','Vicaría'],
              ['decanato','Decanato'],
              ['obispo','Obispo / Ordinario'],
              ['obispoAuxiliar','Obispo Auxiliar (Opcional)'],
              ['canciller','Canciller'],
              ['viceCanciller','Vice-Canciller (Opcional)']
            ].map(([name,label]) => (
              <div className="space-y-1" key={name}>
                <label className={labelClass}>{label}</label>
                <Input name={name} value={formData[name] || ''} readOnly className={linkedClass} />
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
          <Button variant="ghost" onClick={onClose} className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Descartar
          </Button>
          <Button onClick={handleSave} disabled={loadingContext}
            className="rounded-2xl bg-[#4B7BA7] px-10 py-7 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-blue-900/20 hover:bg-[#3A6286]">
            <Save className="mr-2 h-4 w-4" /> Guardar Registro
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ManualMisDatosModal;
