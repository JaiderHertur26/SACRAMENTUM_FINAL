import React from 'react';
import { useLocation } from 'react-router-dom';
import ParishParametersEvidencePage from '@/components/parish/ParishParametersEvidencePage';

export default function BaptismParametersPage() {
  const { pathname, search } = useLocation();
  const funeral = pathname.includes('/exequias/parametros')
    || new URLSearchParams(search).get('tab') === 'exequias';
  return <ParishParametersEvidencePage sacrament={funeral ? 'exequias' : 'bautismo'} />;
}
