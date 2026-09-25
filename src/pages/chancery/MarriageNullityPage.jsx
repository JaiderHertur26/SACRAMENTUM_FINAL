import React from 'react';
import { Navigate } from 'react-router-dom';

const MarriageNullityPage = () => (
  <Navigate to="/chancery/decretos?sacrament=matrimonio" replace />
);

export default MarriageNullityPage;
