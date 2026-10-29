import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import DecreeCenterHeader from '@/components/chancery/DecreeCenterHeader';

/**
 * Entrada única al Centro de Decretos. Las operaciones institucionales
 * complementarias tienen una ruta independiente; no se montan aquí ni
 * disparan consultas al entrar al centro.
 */
const SacramentalDecreesCenterPage = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout entityName={user?.dioceseName || 'Cancillería'}>
      <main className="mx-auto w-full max-w-7xl pb-12">
        <DecreeCenterHeader showCenterButton={false} selectionOnly />
      </main>
    </DashboardLayout>
  );
};

export default SacramentalDecreesCenterPage;
