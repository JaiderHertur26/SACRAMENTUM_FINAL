import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

const ViewCorrectionPage = () => {
  const [params] = useSearchParams();
  const raw = String(params.get('tab') || '').toLowerCase();
  const sacrament = raw.includes('confirm') ? 'confirmacion' : 'bautismo';
  return <Navigate to={`/chancery/decretos/archivo?sacrament=${sacrament}&type=correccion`} replace />;
};

export default ViewCorrectionPage;
