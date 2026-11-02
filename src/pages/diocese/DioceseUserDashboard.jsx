import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import EcclesialCommandCenter from '@/components/EcclesialCommandCenter';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';

const DioceseUserDashboard = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [stats, setStats] = useState({ parishes: 0, vicaries: 0, deaneries: 0 });
  const [realDioceseName, setRealDioceseName] = useState('Cargando Jurisdicción...');

  useEffect(() => {
    const fetchDashboardStats = async () => {
      if (!user) return;
      
      // Rastreador: Buscamos el ID real directo en la base de datos
      let currentDioceseId = user.diocese_id || user.dioceseId;
      
      if (!currentDioceseId && user.email) {
          const { data: profile } = await supabase
              .from('user_profiles')
              .select('diocese_id')
              .eq('email', user.email)
              .single();
          if (profile) currentDioceseId = profile.diocese_id;
      }

      if (!currentDioceseId) {
          setLoadError(true);
          setLoading(false);
          return;
      }

      try {
          // 1. Descargamos el nombre real de la Diócesis
          const { data: dioData, error: dioceseError } = await supabase.from('dioceses').select('name').eq('id', currentDioceseId).single();
          if (dioceseError) throw dioceseError;
          if (dioData) setRealDioceseName(dioData.name);

          // 2. Descargamos los conteos reales desde la nube de Supabase
          const [parishRes, vicRes, decRes] = await Promise.all([
              supabase.from('parishes').select('*', { count: 'exact', head: true }).eq('diocese_id', currentDioceseId).eq('is_operational', true),
              supabase.from('vicarias').select('*', { count: 'exact', head: true }).eq('diocese_id', currentDioceseId),
              supabase.from('decanatos').select('*', { count: 'exact', head: true }).eq('diocese_id', currentDioceseId)
          ]);

          const queryError = [parishRes, vicRes, decRes].find(result => result.error)?.error;
          if (queryError) throw queryError;
          setStats({
              parishes: parishRes.count || 0,
              vicaries: vicRes.count || 0,
              deaneries: decRes.count || 0
          });

      } catch (error) {
          console.error("Error al sincronizar estadísticas:", error);
          setLoadError(true);
      } finally {
          setLoading(false);
      }
    };

    fetchDashboardStats();
  }, [user]);

  return (
    <DashboardLayout entityName={realDioceseName} commandCenter>
      <EcclesialCommandCenter
        role="diocese"
        entityName={realDioceseName}
        loading={loading}
        error={loadError}
        metrics={[
          { label: 'Parroquias', value: stats.parishes, icon: 'church', to: '/diocese/ecclesiastical' },
          { label: 'Vicarías', value: stats.vicaries, icon: 'network', to: '/diocese/ecclesiastical' },
          { label: 'Decanatos', value: stats.deaneries, icon: 'folder', to: '/diocese/ecclesiastical' },
        ]}
      />
    </DashboardLayout>
  );
};

export default DioceseUserDashboard;
