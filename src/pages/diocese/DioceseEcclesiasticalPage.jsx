import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle, Building2, CheckCircle2, Church, Copy, Edit, Eye,
  LayoutGrid, Loader2, MapPin, Network, ShieldCheck, Trash2, User,
} from 'lucide-react';

import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { generateActivationToken } from '@/lib/activationTokens';
import {
  deleteChancery,
  deleteDeanery,
  deleteParish,
  deleteVicary,
  loadEcclesiasticalStructure,
  profileForChancery,
  profileForParish,
} from '@/services/ecclesiasticalStructureService';

import CreateVicaryModal from '@/components/modals/CreateVicaryModal';
import CreateDecanateModal from '@/components/modals/CreateDecanateModal';
import EditParishModal from '@/components/modals/EditParishModal';
import EditChancellorModal from '@/components/modals/EditChancellorModal';
import EditVicaryModal from '@/components/modals/EditVicaryModal';
import EditDecanateModal from '@/components/modals/EditDecanateModal';
import ParishDetailsModal from '@/components/modals/ParishDetailsModal';
import { institutionalConfirm } from '@/lib/institutionalDialog';

const EMPTY_ENV = { name: '', city: '', vicaryId: '', deaneryId: '', priest: '' };
const initialModals = {
  createVicary: false,
  createDecanate: false,
  editParish: false,
  editChancellor: false,
  editVicary: false,
  editDecanate: false,
  parishDetails: false,
};

const normalizedId = (value) => String(value || '');

const DioceseEcclesiasticalPage = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [currentDioceseId, setCurrentDioceseId] = useState(null);
  const [realDioceseName, setRealDioceseName] = useState('Jurisdicción');
  const [realChancery, setRealChancery] = useState(null);
  const [realVicaries, setRealVicaries] = useState([]);
  const [realDeaneries, setRealDeaneries] = useState([]);
  const [realParishes, setRealParishes] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [pendingEnvs, setPendingEnvs] = useState([]);
  const [loadingStructure, setLoadingStructure] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [modals, setModals] = useState(initialModals);
  const [selectedItem, setSelectedItem] = useState(null);

  const [envModal, setEnvModal] = useState({ isOpen: false, type: 'PARISH' });
  const [envFormData, setEnvFormData] = useState(EMPTY_ENV);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const resolveDioceseId = useCallback(async () => {
    let id = user?.diocese_id || user?.dioceseId || null;
    if (id) return id;
    if (!user?.id && !user?.email) return null;

    let query = supabase.from('user_profiles').select('diocese_id');
    query = user?.id ? query.eq('auth_user_id', user.id) : query.eq('email', user.email);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data?.diocese_id || null;
  }, [user]);

  const refreshStructure = useCallback(async () => {
    if (!user) return;
    setLoadingStructure(true);
    setLoadError('');
    try {
      const dioceseId = await resolveDioceseId();
      if (!dioceseId) throw new Error('Tu perfil no tiene una Diócesis/Arquidiócesis vinculada.');
      setCurrentDioceseId(dioceseId);

      const structure = await loadEcclesiasticalStructure(dioceseId, user.id);
      setRealDioceseName(structure.diocese?.name || user?.dioceseName || 'Jurisdicción');
      setRealChancery(structure.chancery);
      setRealVicaries(structure.vicaries);
      setRealDeaneries(structure.deaneries);
      setRealParishes(structure.parishes);
      setProfiles(structure.profiles);
      setPendingEnvs(structure.pending);
    } catch (error) {
      console.error('No fue posible cargar la organización eclesiástica:', error);
      setLoadError(error?.message || 'No fue posible cargar la estructura desde Supabase.');
    } finally {
      setLoadingStructure(false);
    }
  }, [resolveDioceseId, user]);

  useEffect(() => {
    refreshStructure();
  }, [refreshStructure]);

  const openModal = (name, item = null) => {
    setSelectedItem(item);
    setModals((prev) => ({ ...prev, [name]: true }));
  };

  const closeModal = (name) => {
    setModals((prev) => ({ ...prev, [name]: false }));
    setSelectedItem(null);
  };

  const getDeaneries = useCallback(
    (vicaryId) => realDeaneries.filter((d) => normalizedId(d.vicaria_id || d.vicaryId) === normalizedId(vicaryId)),
    [realDeaneries]
  );

  const getParishesByDeanery = useCallback(
    (deaneryId) => realParishes.filter((p) => normalizedId(p.decanate_id || p.decanateId || p.deanery_id) === normalizedId(deaneryId)),
    [realParishes]
  );

  const getDirectParishes = useCallback(
    (vicaryId) => realParishes.filter((p) => {
      const parishVicary = p.vicary_id || p.vicaryId;
      const parishDeanery = p.decanate_id || p.decanateId || p.deanery_id;
      return normalizedId(parishVicary) === normalizedId(vicaryId) && !parishDeanery;
    }),
    [realParishes]
  );

  const unassignedParishes = useMemo(
    () => realParishes.filter((p) => !(p.vicary_id || p.vicaryId)),
    [realParishes]
  );

  const availableDeaneriesForForm = useMemo(
    () => envFormData.vicaryId ? getDeaneries(envFormData.vicaryId) : [],
    [envFormData.vicaryId, getDeaneries]
  );

  const hasPendingChancery = pendingEnvs.some((env) => env.type === 'CHANCERY');
  const chanceryProfile = realChancery ? profileForChancery(profiles, realChancery.id) : null;

  const showError = (title, error) => {
    toast({ title, description: error?.message || String(error || 'Operación rechazada.'), variant: 'destructive' });
  };

  const handleDeleteVicary = async (vicary) => {
    const hasDeaneries = getDeaneries(vicary.id).length > 0;
    const hasParishes = realParishes.some((p) => normalizedId(p.vicary_id || p.vicaryId) === normalizedId(vicary.id));
    if (hasDeaneries || hasParishes) {
      toast({ title: 'Vicaría en uso', description: 'Reubica o elimina primero sus decanatos y parroquias.', variant: 'destructive' });
      return;
    }
    if (!(await institutionalConfirm({
      title: 'Eliminar vicaría',
      message: `Se eliminará la vicaría vacía “${vicary.name}”.`,
      confirmText: 'Sí, eliminar',
      tone: 'destructive'
    }))) return;
    try {
      await deleteVicary(vicary.id, currentDioceseId);
      setRealVicaries((prev) => prev.filter((item) => item.id !== vicary.id));
      toast({ title: 'Vicaría eliminada', description: 'La estructura vacía fue retirada de Supabase.' });
    } catch (error) { showError('No se pudo eliminar la vicaría', error); }
  };

  const handleDeleteDeanery = async (deanery) => {
    if (getParishesByDeanery(deanery.id).length > 0) {
      toast({ title: 'Decanato en uso', description: 'Reubica primero las parroquias vinculadas.', variant: 'destructive' });
      return;
    }
    if (!(await institutionalConfirm({
      title: 'Eliminar decanato',
      message: `Se eliminará el decanato vacío “${deanery.name}”.`,
      confirmText: 'Sí, eliminar',
      tone: 'destructive'
    }))) return;
    try {
      await deleteDeanery(deanery.id, currentDioceseId);
      setRealDeaneries((prev) => prev.filter((item) => item.id !== deanery.id));
      toast({ title: 'Decanato eliminado', description: 'La estructura vacía fue retirada de Supabase.' });
    } catch (error) { showError('No se pudo eliminar el decanato', error); }
  };

  const handleDeleteParish = async (parish) => {
    const parishProfile = profileForParish(profiles, parish.id);
    if (parishProfile) {
      toast({
        title: 'Parroquia institucional activa',
        description: 'No se elimina una parroquia que ya tiene identidad de acceso. Revoca el acceso desde usuarios si corresponde.',
        variant: 'destructive',
      });
      return;
    }
    if (!(await institutionalConfirm({
      title: 'Eliminar parroquia',
      message: `Se eliminará la parroquia vacía “${parish.name}”.`,
      confirmText: 'Sí, eliminar',
      tone: 'destructive'
    }))) return;
    try {
      await deleteParish(parish.id, currentDioceseId);
      setRealParishes((prev) => prev.filter((item) => item.id !== parish.id));
      toast({ title: 'Parroquia eliminada', description: 'La entidad sin cuenta activa fue retirada de Supabase.' });
    } catch (error) { showError('No se pudo eliminar la parroquia', error); }
  };

  const handleDeleteChancery = async () => {
    if (!realChancery) return;
    if (chanceryProfile) {
      toast({ title: 'Cancillería institucional activa', description: 'No se elimina mientras tenga una identidad vinculada.', variant: 'destructive' });
      return;
    }
    if (!(await institutionalConfirm({
      title: 'Eliminar Cancillería',
      message: `Se eliminará la Cancillería sin cuenta activa “${realChancery.name}”.`,
      confirmText: 'Sí, eliminar',
      tone: 'destructive'
    }))) return;
    try {
      await deleteChancery(realChancery.id, currentDioceseId);
      setRealChancery(null);
      toast({ title: 'Cancillería eliminada', description: 'La entidad sin cuenta activa fue retirada de Supabase.' });
    } catch (error) { showError('No se pudo eliminar la Cancillería', error); }
  };

  const handleGenerateToken = async (e) => {
    e.preventDefault();
    if (!currentDioceseId || !user?.id) {
      toast({ title: 'Jurisdicción no disponible', description: 'Recarga la página antes de generar un código.', variant: 'destructive' });
      return;
    }

    const type = String(envModal.type || '').toUpperCase();
    if (!['PARISH', 'CHANCERY'].includes(type)) return;
    if (!envFormData.name.trim() || !envFormData.city.trim()) {
      toast({ title: 'Datos incompletos', description: 'Nombre y ciudad son obligatorios.', variant: 'destructive' });
      return;
    }
    if (type === 'CHANCERY' && (realChancery || hasPendingChancery)) {
      toast({ title: 'Cancillería ya asignada', description: 'Sólo puede existir una Cancillería por jurisdicción.', variant: 'destructive' });
      return;
    }
    if (type === 'PARISH' && (!envFormData.vicaryId || !envFormData.deaneryId)) {
      toast({ title: 'Jerarquía obligatoria', description: 'Toda parroquia debe quedar asignada a una Vicaría y a un Decanato.', variant: 'destructive' });
      return;
    }
    if (type === 'PARISH' && envFormData.deaneryId) {
      const selectedDeanery = realDeaneries.find((d) => d.id === envFormData.deaneryId);
      if (!selectedDeanery || normalizedId(selectedDeanery.vicaria_id || selectedDeanery.vicaryId) !== normalizedId(envFormData.vicaryId)) {
        toast({ title: 'Jerarquía inválida', description: 'El decanato seleccionado no pertenece a la vicaría indicada.', variant: 'destructive' });
        return;
      }
    }

    setIsGenerating(true);
    try {
      const token = generateActivationToken(type, envFormData.name);
      const payload = type === 'PARISH'
        ? {
            name: envFormData.name.trim(),
            city: envFormData.city.trim(),
            priest: envFormData.priest.trim() || null,
            vicaryId: envFormData.vicaryId || null,
            decanateId: envFormData.deaneryId || null,
            dioceseId: currentDioceseId,
          }
        : {
            name: envFormData.name.trim(),
            city: envFormData.city.trim(),
            dioceseId: currentDioceseId,
          };

      const { data, error } = await supabase.from('pending_tokens').insert([{
        token,
        type,
        payload,
        created_by: user.id,
      }]).select('id,token,type,payload,created_by,created_at').single();
      if (error) throw error;

      const pending = {
        id: data.id,
        token: data.token,
        type: data.type,
        ...(data.payload || {}),
        created_at: data.created_at,
        date: new Date(data.created_at).toLocaleDateString(),
      };
      setPendingEnvs((prev) => [pending, ...prev]);
      setGeneratedCode(token);
      toast({ title: 'Código generado', description: 'La autorización quedó guardada en Supabase.' });
    } catch (error) {
      showError('No se pudo generar el código', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeletePending = async (env) => {
    if (!(await institutionalConfirm({
      title: 'Revocar código de activación',
      message: `El código pendiente de ${env.name} dejará de ser válido.`,
      confirmText: 'Sí, revocar código',
      tone: 'warning'
    }))) return;
    try {
      const { data, error } = await supabase.from('pending_tokens').delete().eq('id', env.id).eq('created_by', user.id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('El código ya no existe o no pertenece a tu cuenta.');
      setPendingEnvs((prev) => prev.filter((item) => item.id !== env.id));
      toast({ title: 'Código revocado', description: 'Ya no podrá utilizarse para activar un entorno.' });
    } catch (error) { showError('No se pudo revocar el código', error); }
  };

  const resetEnvModal = () => {
    setEnvModal({ isOpen: false, type: 'PARISH' });
    setGeneratedCode(null);
    setEnvFormData(EMPTY_ENV);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado', description: 'Código de activación copiado.' });
    } catch {
      toast({ title: 'No se pudo copiar', description: 'Selecciona el código y cópialo manualmente.', variant: 'destructive' });
    }
  };

  const ParishTable = ({ parishes, label = '' }) => {
    if (!parishes.length) return null;
    return (
      <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm mt-4">
        {label && <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-100"><span className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest">{label}</span></div>}
        <table className="w-full text-sm text-left">
          <thead className="bg-white border-b border-slate-50 text-[9px] uppercase text-slate-400 font-black tracking-widest">
            <tr><th className="px-6 py-4">Parroquia</th><th className="px-6 py-4">Párroco</th><th className="px-6 py-4">Cuenta</th><th className="px-6 py-4 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {parishes.map((parish) => {
              const parishProfile = profileForParish(profiles, parish.id);
              return (
                <tr key={parish.id} className="hover:bg-slate-50/50 group">
                  <td className="px-6 py-4 font-black text-slate-800 uppercase"><div className="flex items-center gap-3"><Church className="w-4 h-4 text-[#4B7BA7]" />{parish.name}</div></td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-600">{parish.parroco || 'Sin asignar'}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{parishProfile?.full_name || parishProfile?.email || 'Sin activar'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openModal('parishDetails', parish)} className="p-2 hover:bg-amber-50 rounded-xl text-[#D4AF37]"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openModal('editParish', parish)} className="p-2 hover:bg-blue-50 rounded-xl text-[#4B7BA7]"><Edit className="w-4 h-4" /></button>
                      {!parishProfile && <button onClick={() => handleDeleteParish(parish)} className="p-2 hover:bg-red-50 rounded-xl text-red-500"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading || loadingStructure) {
    return <div className="flex h-screen items-center justify-center bg-slate-50"><div className="text-center"><Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mx-auto mb-4" /><p className="text-[#4B7BA7] font-black uppercase tracking-widest text-[10px]">Cargando estructura oficial...</p></div></div>;
  }

  return (
    <>
      <Helmet><title>Organización Eclesiástica · SACRAMENTUM</title></Helmet>
      <DashboardLayout entityName={realDioceseName}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-[1600px] mx-auto space-y-8 pb-20">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none flex items-center gap-3"><Network className="w-10 h-10 text-[#4B7BA7]" /> Organización Eclesiástica</h1>
              <p className="text-[#4B7BA7] text-[10px] font-black uppercase tracking-[0.3em] mt-2 ml-1">{realDioceseName} · estructura oficial en Supabase</p>
            </div>
            <Button variant="outline" onClick={refreshStructure} className="rounded-xl" disabled={loadingStructure}>Actualizar datos</Button>
          </div>

          {loadError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5 flex gap-3"><AlertCircle className="w-5 h-5 shrink-0" /><div><p className="font-black">No se pudo cargar toda la estructura</p><p className="text-sm">{loadError}</p></div></div>}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="secondary" onClick={() => openModal('createVicary')} className="h-16 rounded-2xl font-black uppercase tracking-widest text-[10px]"><Network className="w-5 h-5 mr-2" /> Crear Vicaría</Button>
            <Button variant="secondary" onClick={() => openModal('createDecanate')} disabled={!realVicaries.length} className="h-16 rounded-2xl font-black uppercase tracking-widest text-[10px]"><LayoutGrid className="w-5 h-5 mr-2" /> Crear Decanato</Button>
            <Button onClick={() => setEnvModal({ isOpen: true, type: 'PARISH' })} disabled={!realVicaries.length || !realDeaneries.length} className="h-16 rounded-2xl bg-[#4B7BA7] hover:bg-[#3A6286] text-white disabled:bg-slate-100 disabled:text-slate-400 font-black uppercase tracking-widest text-[10px]"><Church className="w-5 h-5 mr-2" /> Autorizar Parroquia</Button>
            <Button onClick={() => setEnvModal({ isOpen: true, type: 'CHANCERY' })} disabled={!!realChancery || hasPendingChancery} className="h-16 rounded-2xl bg-[#D4AF37] hover:bg-[#C4A027] text-[#111111] disabled:bg-slate-100 disabled:text-slate-400 font-black uppercase tracking-widest text-[10px]"><Building2 className="w-5 h-5 mr-2" /> {realChancery ? 'Cancillería Activa' : hasPendingChancery ? 'Cancillería Pendiente' : 'Autorizar Cancillería'}</Button>
          </div>

          {realChancery && (
            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-[#D4AF37] to-[#B4932A] p-6 lg:px-10 flex justify-between items-center">
                <div><h3 className="font-black text-2xl text-white uppercase">{realChancery.name}</h3><p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mt-1"><MapPin className="w-3 h-3 inline mr-1" />{realChancery.city || 'Sede no especificada'} · {chanceryProfile?.full_name || chanceryProfile?.email || 'Sin cuenta activada'}</p></div>
                <div className="flex gap-2"><button onClick={() => openModal('editChancellor', realChancery)} className="p-3 bg-white/15 rounded-xl text-white"><Edit className="w-4 h-4" /></button>{!chanceryProfile && <button onClick={handleDeleteChancery} className="p-3 bg-red-500/30 rounded-xl text-white"><Trash2 className="w-4 h-4" /></button>}</div>
              </div>
            </div>
          )}

          {unassignedParishes.length > 0 && <div className="bg-white rounded-3xl border border-amber-200 p-6"><div className="flex items-center gap-2 mb-3"><AlertCircle className="w-5 h-5 text-amber-500" /><h4 className="font-black text-slate-700 uppercase">Parroquias sin Vicaría Asignada</h4></div><ParishTable parishes={unassignedParishes} /></div>}

          <AnimatePresence>
            {pendingEnvs.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-50/50 border border-amber-200 rounded-3xl overflow-hidden">
                <div className="bg-amber-100/60 px-8 py-5 flex items-center justify-between border-b border-amber-200"><div><h3 className="font-black text-amber-900 uppercase">Autorizaciones Pendientes</h3><p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Códigos aún no consumidos</p></div><span className="bg-white px-4 py-2 rounded-xl font-black text-amber-800">{pendingEnvs.length}</span></div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {pendingEnvs.map((env) => <div key={env.id} className="bg-white p-5 rounded-2xl border border-amber-100 relative"><span className="text-[9px] font-black uppercase bg-amber-50 text-amber-800 px-2 py-1 rounded-full">{env.type === 'PARISH' ? 'Parroquia' : 'Cancillería'}</span><h4 className="font-black text-slate-900 uppercase mt-3">{env.name}</h4><p className="text-xs text-slate-500 mt-1">{env.city} · {env.date}</p><div className="bg-amber-50 p-3 rounded-xl border border-dashed border-amber-300 flex justify-between mt-4"><code className="text-xs font-black text-[#4B7BA7]">{env.token}</code><button onClick={() => copyToClipboard(env.token)}><Copy className="w-4 h-4 text-slate-400" /></button></div><button onClick={() => handleDeletePending(env)} className="absolute top-4 right-4 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></div>)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-8">
            {!realVicaries.length ? (
              <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center"><Network className="w-14 h-14 text-slate-300 mx-auto mb-4" /><p className="font-black text-slate-500 uppercase tracking-widest text-xs">No hay vicarías registradas.</p></div>
            ) : realVicaries.map((vicary) => {
              const vicaryDeaneries = getDeaneries(vicary.id);
              const directParishes = getDirectParishes(vicary.id);
              return (
                <div key={vicary.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="bg-slate-800 p-6 lg:px-10 flex justify-between items-center"><div><h3 className="font-black text-2xl text-white uppercase">{vicary.name}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1"><User className="w-3 h-3 inline mr-1 text-[#D4AF37]" />Vicario: {vicary.vicar_name || 'Sin asignar'}</p></div><div className="flex gap-2"><button onClick={() => openModal('editVicary', vicary)} className="p-3 bg-slate-700 rounded-xl text-white"><Edit className="w-4 h-4" /></button><button onClick={() => handleDeleteVicary(vicary)} className="p-3 bg-red-500/20 rounded-xl text-red-300"><Trash2 className="w-4 h-4" /></button></div></div>
                  <div className="p-6 lg:p-10 space-y-8">
                    {!vicaryDeaneries.length && !directParishes.length && <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic text-center py-6">Vicaría sin decanatos ni parroquias.</p>}
                    {vicaryDeaneries.map((deanery) => <div key={deanery.id} className="p-6 rounded-2xl border border-slate-100"><div className="flex justify-between items-center mb-4"><div><h4 className="font-black text-slate-800 uppercase text-lg">{deanery.name}</h4><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Decano: {deanery.dean_name || 'Sin asignar'}</p></div><div className="flex gap-2"><button onClick={() => openModal('editDecanate', deanery)} className="p-2.5 hover:bg-slate-100 rounded-lg text-slate-500"><Edit className="w-4 h-4" /></button><button onClick={() => handleDeleteDeanery(deanery)} className="p-2.5 hover:bg-red-50 rounded-lg text-red-400"><Trash2 className="w-4 h-4" /></button></div></div><ParishTable parishes={getParishesByDeanery(deanery.id)} /></div>)}
                    {directParishes.length > 0 && <div className="bg-blue-50/30 p-5 rounded-2xl border border-dashed border-[#4B7BA7]/30"><ParishTable parishes={directParishes} label="Parroquias directamente adscritas a la Vicaría" /></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        <Modal isOpen={envModal.isOpen} onClose={resetEnvModal} title={generatedCode ? 'Código de Activación Generado' : `Autorizar ${envModal.type === 'PARISH' ? 'Parroquia' : 'Cancillería'}`}>
          <div className="w-full max-w-md mx-auto p-2">
            <AnimatePresence mode="wait">
              {!generatedCode ? (
                <motion.form key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleGenerateToken} className="space-y-4">
                  <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre Oficial</label><input required value={envFormData.name} onChange={(e) => setEnvFormData({ ...envFormData, name: e.target.value })} className="w-full mt-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold" placeholder={envModal.type === 'PARISH' ? 'Parroquia San José' : 'Cancillería Arquidiocesana'} /></div>
                  <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ciudad / Municipio</label><input required value={envFormData.city} onChange={(e) => setEnvFormData({ ...envFormData, city: e.target.value })} className="w-full mt-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold" placeholder="Barranquilla" /></div>
                  {envModal.type === 'PARISH' && <><div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Párroco Actual (Opcional)</label><input value={envFormData.priest} onChange={(e) => setEnvFormData({ ...envFormData, priest: e.target.value })} className="w-full mt-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl"><div><label className="text-[9px] font-black text-slate-500 uppercase">Vicaría</label><select value={envFormData.vicaryId} onChange={(e) => setEnvFormData({ ...envFormData, vicaryId: e.target.value, deaneryId: '' })} className="w-full mt-1 px-3 py-3 bg-white border rounded-lg"><option value="">Seleccione Vicaría</option>{realVicaries.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div><div><label className="text-[9px] font-black text-slate-500 uppercase">Decanato</label><select value={envFormData.deaneryId} onChange={(e) => setEnvFormData({ ...envFormData, deaneryId: e.target.value })} disabled={!envFormData.vicaryId} className="w-full mt-1 px-3 py-3 bg-white border rounded-lg"><option value="">Seleccione Decanato</option>{availableDeaneriesForForm.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div></div></>}
                  <div className="pt-4 flex gap-3"><Button type="button" variant="outline" onClick={resetEnvModal} className="w-1/3">Cancelar</Button><Button type="submit" disabled={isGenerating} className="w-2/3 bg-[#4B7BA7] text-white">{isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generar Código'}</Button></div>
                </motion.form>
              ) : (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center space-y-6"><CheckCircle2 className="w-16 h-16 text-green-600 mx-auto" /><div><h3 className="text-xl font-black">{envFormData.name}</h3><p className="text-sm text-slate-500">Entregue este código al responsable para completar la activación pública.</p></div><div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-[#D4AF37]"><p className="text-2xl font-mono font-black tracking-wider break-all">{generatedCode}</p></div><Button onClick={() => copyToClipboard(generatedCode)} className="w-full bg-[#D4AF37] text-slate-900"><Copy className="w-4 h-4 mr-2" /> Copiar Código</Button><Button variant="outline" onClick={resetEnvModal} className="w-full">Cerrar</Button></motion.div>
              )}
            </AnimatePresence>
          </div>
        </Modal>

        {modals.createVicary && <CreateVicaryModal isOpen={modals.createVicary} onClose={() => closeModal('createVicary')} dioceseId={currentDioceseId} onCreated={(created) => setRealVicaries((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))} />}
        {modals.createDecanate && <CreateDecanateModal isOpen={modals.createDecanate} onClose={() => closeModal('createDecanate')} dioceseId={currentDioceseId} onCreated={(created) => setRealDeaneries((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))} />}
        {modals.editVicary && <EditVicaryModal isOpen={modals.editVicary} onClose={() => closeModal('editVicary')} vicary={selectedItem} dioceseId={currentDioceseId} onUpdated={(updated) => setRealVicaries((prev) => prev.map((v) => v.id === updated.id ? updated : v))} />}
        {modals.editDecanate && <EditDecanateModal isOpen={modals.editDecanate} onClose={() => closeModal('editDecanate')} decanate={selectedItem} dioceseId={currentDioceseId} vicaries={realVicaries} onUpdated={(updated) => setRealDeaneries((prev) => prev.map((d) => d.id === updated.id ? updated : d))} />}
        {modals.editParish && <EditParishModal isOpen={modals.editParish} onClose={() => closeModal('editParish')} parish={selectedItem} dioceseId={currentDioceseId} vicaries={realVicaries} deaneries={realDeaneries} onUpdated={(updated) => setRealParishes((prev) => prev.map((p) => p.id === updated.id ? updated : p))} />}
        {modals.editChancellor && <EditChancellorModal isOpen={modals.editChancellor} onClose={() => closeModal('editChancellor')} chancellor={selectedItem} dioceseId={currentDioceseId} profile={chanceryProfile} onUpdated={setRealChancery} />}
        {modals.parishDetails && <ParishDetailsModal isOpen={modals.parishDetails} onClose={() => closeModal('parishDetails')} parish={selectedItem} vicaries={realVicaries} deaneries={realDeaneries} profile={selectedItem ? profileForParish(profiles, selectedItem.id) : null} />}
      </DashboardLayout>
    </>
  );
};

export default DioceseEcclesiasticalPage;
