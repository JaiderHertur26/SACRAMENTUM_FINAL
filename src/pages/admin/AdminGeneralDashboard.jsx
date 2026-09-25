import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity, Church, Copy, Download, Eye, FileText, LayoutDashboard,
  Search, Settings as SettingsIcon, ShieldCheck, Trash2, Users,
} from 'lucide-react';

import DashboardLayout from '@/components/DashboardLayout';
import DetailsModal from '@/components/modals/DetailsModal';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { ROLE_TYPES } from '@/config/supabaseConfig';
import { institutionalConfirm } from '@/lib/institutionalDialog';

const AdminGeneralDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [pendingDioceses, setPendingDioceses] = useState([]);
  const [activeDioceses, setActiveDioceses] = useState([]);
  const [systemStats, setSystemStats] = useState({ dioceses: 0, parishes: 0, sacraments: 0, users: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDiocese, setSelectedDiocese] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCloudData = useCallback(async () => {
    setLoading(true);
    try {
      const [tokensRes, diocesesRes, profilesRes, parishesRes, baptismsRes, confirmationsRes, marriagesRes, funeralsRes] = await Promise.all([
        supabase.from('pending_tokens').select('id,token,type,payload,created_by,created_at').eq('type', 'DIOCESE').order('created_at', { ascending: false }),
        supabase.from('dioceses').select('*').order('name'),
        supabase.from('user_profiles').select('id,email,username,full_name,role,diocese_id,status,is_active'),
        supabase.from('parishes').select('*', { count: 'exact', head: true }),
        supabase.from('baptisms').select('*', { count: 'exact', head: true }),
        supabase.from('confirmations').select('*', { count: 'exact', head: true }),
        supabase.from('marriages').select('*', { count: 'exact', head: true }),
        supabase.from('funerals').select('*', { count: 'exact', head: true }),
      ]);

      const firstError = [tokensRes, diocesesRes, profilesRes, parishesRes, baptismsRes, confirmationsRes, marriagesRes, funeralsRes]
        .find((result) => result.error)?.error;
      if (firstError) throw firstError;

      const profiles = profilesRes.data || [];
      const dioceses = (diocesesRes.data || []).map((diocese) => {
        const adminUser = profiles.find(
          (profile) => profile.diocese_id === diocese.id && String(profile.role || '').toLowerCase() === ROLE_TYPES.DIOCESE
        );
        return {
          ...diocese,
          username: adminUser
            ? adminUser.full_name || adminUser.email || adminUser.username || 'Sin asignar'
            : 'Sin asignar',
          userId: adminUser?.id || null,
        };
      });

      setActiveDioceses(dioceses);
      setPendingDioceses((tokensRes.data || []).map((item) => ({
        id: item.id,
        token: item.token,
        ...(item.payload || {}),
        created_by: item.created_by,
        date: item.created_at ? new Date(item.created_at).toLocaleDateString() : '',
      })));
      setSystemStats({
        dioceses: dioceses.length,
        parishes: parishesRes.count || 0,
        sacraments: (baptismsRes.count || 0) + (confirmationsRes.count || 0) + (marriagesRes.count || 0) + (funeralsRes.count || 0),
        users: profiles.length,
      });
    } catch (error) {
      console.error('Fallo al sincronizar el Panel General:', error);
      toast({
        title: 'No fue posible sincronizar el Panel General',
        description: error?.message || 'Verifica la conexión y las políticas de Supabase.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCloudData();
  }, [loadCloudData]);

  const menuItems = [
    { label: 'Inicio', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Buscador Unificado', path: '/buscar', icon: Search },
    { label: 'Diócesis/Arquidiócesis', path: '/admin/dioceses', icon: Church },
    { label: 'Ajustes', path: '/admin/settings', icon: SettingsIcon },
  ];

  const stats = [
    { label: 'Diócesis Activas', value: systemStats.dioceses, icon: Church, color: 'bg-blue-600', text: 'text-blue-700' },
    { label: 'Total Parroquias', value: systemStats.parishes, icon: Church, color: 'bg-blue-500', text: 'text-blue-700' },
    { label: 'Total Sacramentos', value: systemStats.sacraments, icon: FileText, color: 'bg-[#D4AF37]', text: 'text-amber-700' },
    { label: 'Total Usuarios', value: systemStats.users, icon: Users, color: 'bg-slate-700', text: 'text-slate-700' },
  ];

  const dioceseTableData = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return activeDioceses;
    return activeDioceses.filter((item) =>
      [item.name, item.city, item.bishop, item.username]
        .some((value) => String(value || '').toLowerCase().includes(needle))
    );
  }, [activeDioceses, searchTerm]);

  const handleDeletePending = async (pending) => {
    if (!(await institutionalConfirm({
      title: 'Revocar código de activación',
      message: `El código pendiente de ${pending.name || 'esta jurisdicción'} dejará de ser válido.`,
      confirmText: 'Sí, revocar código',
      tone: 'warning'
    }))) return;
    try {
      let query = supabase.from('pending_tokens').delete().eq('id', pending.id);
      if (user?.id) query = query.eq('created_by', user.id);
      const { data, error } = await query.select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('El código ya no existe o no pertenece a tu cuenta.');
      setPendingDioceses((prev) => prev.filter((item) => item.id !== pending.id));
      toast({ title: 'Código revocado', description: 'La autorización ya no podrá utilizarse.' });
    } catch (error) {
      toast({ title: 'No se pudo revocar el código', description: error?.message || 'Operación rechazada.', variant: 'destructive' });
    }
  };

  const copyToClipboard = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: 'Copiado', description: 'Código de activación copiado.' });
    } catch {
      toast({ title: 'No se pudo copiar', description: 'Selecciona el código y cópialo manualmente.', variant: 'destructive' });
    }
  };

  const columnsDioceses = [
    { header: 'Nombre', accessor: 'name' },
    {
      header: 'Tipo',
      render: (row) => (
        <span className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${row.type === 'archdiocese' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>
          {row.type === 'archdiocese' ? 'Arquidiócesis' : 'Diócesis'}
        </span>
      ),
    },
    { header: 'Obispo/Arzobispo', render: (row) => <span className="font-medium text-slate-700">{row.bishop || row.bishop_name || 'No registrado'}</span> },
    { header: 'Usuario Vinculado', render: (row) => <span className="text-xs font-bold text-slate-600">{row.username}</span> },
    {
      header: 'Acciones',
      render: (row) => (
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" title="Ver detalles" onClick={() => { setSelectedDiocese(row); setIsDetailsModalOpen(true); }}>
            <Eye className="w-4 h-4 text-slate-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout menuItems={menuItems} entityName="Administración General">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950 flex items-center gap-3 tracking-tight">
              <ShieldCheck className="w-8 h-8 text-[#D4AF37]" /> Panel General
            </h1>
            <p className="text-slate-500 mt-1 uppercase text-xs font-bold tracking-widest">Control Maestro Global del Sistema</p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/admin/settings')}
            className="gap-2 border-slate-200 text-slate-700 bg-white rounded-2xl h-12 px-6 hover:bg-slate-50 shadow-sm"
          >
            <SettingsIcon className="w-4 h-4 text-blue-600" /> Seguridad y respaldos
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex items-center gap-5">
              <div className={`p-4 rounded-2xl ${stat.color} bg-opacity-10 shadow-inner`}>
                <stat.icon className={`w-7 h-7 ${stat.text}`} />
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900 tracking-tighter">{loading ? '…' : stat.value}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {pendingDioceses.length > 0 && (
          <div className="mb-10 border border-amber-200 bg-amber-50/40 rounded-3xl overflow-hidden shadow-sm">
            <div className="bg-amber-100/60 p-6 border-b border-amber-200 flex items-center gap-3">
              <Activity className="w-5 h-5 text-amber-700" />
              <h3 className="font-black text-amber-900 uppercase tracking-widest text-xs">Jurisdicciones pendientes de activación</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingDioceses.map((env) => (
                <div key={env.id} className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm relative group">
                  <h4 className="font-black text-slate-900 pr-10 truncate text-lg tracking-tight">{env.name || 'Jurisdicción'}</h4>
                  <p className="text-xs text-slate-500 mb-5 font-medium mt-1">{env.city || '---'} · {env.date}</p>
                  <div className="bg-slate-50 p-3 rounded-xl border border-dashed border-slate-300 flex justify-between items-center gap-2">
                    <code className="text-sm font-black text-[#4B7BA7] tracking-wider truncate">{env.token}</code>
                    <button type="button" onClick={() => copyToClipboard(env.token)} className="text-slate-400 hover:text-[#D4AF37]" title="Copiar código">
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                  <button type="button" onClick={() => handleDeletePending(env)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500" title="Revocar código">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
            <div>
              <h3 className="font-black text-slate-900 text-xl tracking-tight">Jurisdicciones Activas</h3>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Diócesis y Arquidiócesis vinculadas a un usuario en el sistema.</p>
            </div>
            <div className="flex flex-1 md:flex-none gap-4 w-full md:w-auto">
              <div className="relative w-full md:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar Diócesis..."
                  className="w-full pl-11 pr-4 py-3 border border-slate-200 bg-slate-50 rounded-2xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D4AF37] transition-all font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button onClick={() => navigate('/admin/dioceses')} className="bg-[#D4AF37] hover:bg-[#C4A027] text-[#111111] font-black uppercase tracking-widest text-[10px] whitespace-nowrap px-6 rounded-2xl">
                Gestionar Jurisdicciones
              </Button>
            </div>
          </div>
          <Table columns={columnsDioceses} data={dioceseTableData} className="border-none" />
        </div>
      </motion.div>

      <DetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        data={selectedDiocese}
      />
    </DashboardLayout>
  );
};

export default AdminGeneralDashboard;
