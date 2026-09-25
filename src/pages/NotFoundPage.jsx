import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
      <h1 className="text-4xl font-bold text-[#2C3E50] mb-4">404 - Página No Encontrada</h1>
      <p className="text-slate-600 mb-8">La ruta que intentas acceder no existe o no tienes permisos para verla.</p>
      <Link to="/">
        <Button>Volver al Inicio</Button>
      </Link>
    </div>
  );
};

export default NotFoundPage;