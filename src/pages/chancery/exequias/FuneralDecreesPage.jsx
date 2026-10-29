import React from 'react';
import DecreeIssueRouteV285 from '@/pages/chancery/DecreeIssueRouteV285';

// V285: este acceso utiliza exclusivamente la emisión sin coordenadas.
// La ubicación física se asigna DESPUÉS en la parroquia destinataria.
export default function FuneralDecreesPage(){
 return <DecreeIssueRouteV285 sacrament="exequias" />;
}
