import React from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canAccessRole, getDashboardPathForRole, isKnownRole } from '@/lib/authz';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { session, isAuthenticated, isLoading, role, configurationError } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 z-50 fixed top-0 left-0">
        <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mb-4" />
        <p className="text-slate-500 font-black uppercase tracking-widest text-sm">Validando credenciales...</p>
      </div>
    );
  }

  if (session?.user && configurationError) {
    return <Navigate to="/account-configuration-error" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!isKnownRole(role)) {
    return <Navigate to="/account-configuration-error" replace />;
  }

  if (requiredRole && !canAccessRole(role, requiredRole)) {
    return <Navigate to={getDashboardPathForRole(role)} replace />;
  }

  return children;
};

export default ProtectedRoute;
