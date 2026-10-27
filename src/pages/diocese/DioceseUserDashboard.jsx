import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Church, Network, LayoutGrid, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const DioceseUserDashboard = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
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
          setLoading(false);
          return;
      }

      try {
          // 1. Descargamos el nombre real de la Diócesis
          const { data: dioData } = await supabase.from('dioceses').select('name').eq('id', currentDioceseId).single();
          if (dioData) setRealDioceseName(dioData.name);

          // 2. Descargamos los conteos reales desde la nube de Supabase
          const [parishRes, vicRes, decRes] = await Promise.all([
              supabase.from('parishes').select('*', { count: 'exact', head: true }).eq('diocese_id', currentDioceseId).eq('is_operational', true),
              supabase.from('vicarias').select('*', { count: 'exact', head: true }).eq('diocese_id', currentDioceseId),
              supabase.from('decanatos').select('*', { count: 'exact', head: true }).eq('diocese_id', currentDioceseId)
          ]);

          setStats({
              parishes: parishRes.count || 0,
              vicaries: vicRes.count || 0,
              deaneries: decRes.count || 0
          });

      } catch (error) {
          console.error("Error al sincronizar estadísticas:", error);
      } finally {
          setLoading(false);
      }
    };

    fetchDashboardStats();
  }, [user]);

  const statCards = [
    { label: 'Parroquias', value: stats.parishes, icon: Church, color: 'bg-[#f5e8db]', text: 'text-[#743549]' },
    { label: 'Vicarías', value: stats.vicaries, icon: Network, color: 'bg-[#eaf0e9]', text: 'text-[#335449]' },
    { label: 'Decanatos', value: stats.deaneries, icon: LayoutGrid, color: 'bg-[#f7eddb]', text: 'text-[#947039]' },
  ];

  return (
    <DashboardLayout entityName={realDioceseName}>
      <div className="ecclesial-scope-hero mb-8">
        <p className="ecclesial-scope-eyebrow mb-3">Gobierno pastoral · Jurisdicción eclesiástica</p>
        <h1>Vida y organización diocesana</h1>
        <p className="ecclesial-scope-description mt-3">{realDioceseName} · Parroquias, vicarías y decanatos al servicio de la evangelización.</p>
      </div>

      {loading ? (
         <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
            <Loader2 className="w-10 h-10 text-[#D4AF37] animate-spin mb-4" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultando la organización diocesana…</p>
         </div>
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {statCards.map((stat, idx) => (
              <div key={idx} className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-lg transition-all flex items-center gap-5">
                <div className={`p-4 rounded-2xl ${stat.color} shadow-inner`}>
                  <stat.icon className={`w-8 h-8 ${stat.text}`} />
                </div>
                <div>
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{stat.label}</p>
                </div>
              </div>
            ))}
         </div>
      )}
    </DashboardLayout>
  );
};

export default DioceseUserDashboard;