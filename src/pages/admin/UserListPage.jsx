import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { normalizeRole } from '@/lib/authz';
import { KeyRound, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { labelStatus } from '@/utils/uiLabels';

const ROLE_LABELS = {
  admin_general: 'Administrador General',
  diocese: 'Diócesis / Arquidiócesis',
  chancery: 'Cancillería',
  parish: 'Parroquia',
};

const UserListPage = () => {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [resettingId, setResettingId] = useState(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*');

      if (error) throw error;
      setProfiles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al cargar perfiles de usuario:', error);
      toast({
        title: 'No fue posible cargar los usuarios',
        description: error?.message || 'Verifica la conexión y las políticas de acceso de Supabase.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const filteredProfiles = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return profiles;

    return profiles.filter((profile) => {
      const role = normalizeRole(profile?.role);
      return [
        profile?.username,
        profile?.email,
        profile?.status,
        ROLE_LABELS[role],
        profile?.diocese_id,
        profile?.parish_id,
      ].some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [profiles, searchTerm]);

  const sendPasswordReset = async (profile) => {
    if (!profile?.email) {
      toast({
        title: 'Correo no disponible',
        description: 'Este perfil no tiene un correo electrónico válido asociado.',
        variant: 'destructive',
      });
      return;
    }

    setResettingId(profile.id);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;

      toast({
        title: 'Enlace de recuperación enviado',
        description: `Supabase envió el proceso seguro de recuperación a ${profile.email}.`,
      });
    } catch (error) {
      console.error('Error enviando recuperación de contraseña:', error);
      toast({
        title: 'No se pudo enviar el enlace',
        description: error?.message || 'Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setResettingId(null);
    }
  };

  const columns = [
    {
      header: 'Usuario',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-950">{row.username || row.email || 'Usuario'}</div>
          {row.username && row.email && <div className="text-xs text-slate-500 mt-0.5">{row.email}</div>}
        </div>
      ),
    },
    {
      header: 'Rol',
      render: (row) => {
        const role = normalizeRole(row.role);
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-[#3A6286] text-[10px] font-black uppercase tracking-wider">
            {ROLE_LABELS[role] || row.role || 'Sin rol'}
          </span>
        );
      },
    },
    {
      header: 'Estado',
      render: (row) => {
        const active = !row.status || String(row.status).toUpperCase() === 'ACTIVE';
        return (
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${active ? 'text-green-700' : 'text-amber-700'}`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            {active ? 'Activo' : labelStatus(row.status, 'Inactivo')}
          </span>
        );
      },
    },
    {
      header: 'Jurisdicción',
      render: (row) => row.parish_id || row.diocese_id || row.chancery_id || 'Global',
    },
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">Directorio de Usuarios</h1>
          <p className="text-slate-500 mt-1 text-xs font-bold uppercase tracking-widest">
            Perfiles autorizados en Supabase Auth
          </p>
        </div>
        <Button variant="outline" onClick={loadProfiles} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por usuario, correo, rol o estado..."
              className="w-full pl-11 pr-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D4AF37] transition-all"
            />
          </div>
          <div className="text-xs font-bold text-slate-500">
            {filteredProfiles.length} perfil{filteredProfiles.length === 1 ? '' : 'es'}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#4B7BA7]" />
            <span className="text-xs font-bold uppercase tracking-widest">Consultando Supabase...</span>
          </div>
        ) : (
          <Table
            columns={columns}
            data={filteredProfiles}
            actions={[
              {
                type: 'password-reset',
                label: (row) => resettingId === row.id ? 'Enviando...' : 'Restablecer acceso',
                icon: KeyRound,
                disabled: (row) => !row.email || resettingId === row.id,
                className: 'text-[#4B7BA7] hover:text-[#3A6286] hover:bg-blue-50 font-bold text-xs',
                onClick: (row) => sendPasswordReset(row),
              },
            ]}
          />
        )}

        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-900">
          Las contraseñas no se muestran ni se modifican desde esta pantalla. El restablecimiento se realiza mediante el flujo seguro de Supabase Auth.
        </div>
      </div>
    </DashboardLayout>
  );
};

export default UserListPage;
