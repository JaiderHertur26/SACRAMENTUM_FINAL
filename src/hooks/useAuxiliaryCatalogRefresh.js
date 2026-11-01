import { useEffect, useRef } from 'react';
import { SHARED_CATALOG_CHANGED } from '@/services/sharedAuxiliaryCatalogService';

// Al volver a una pantalla se consulta lo que hayan cargado otras parroquias.
// También refresca las opciones de formularios abiertos, sin borrar sus datos.
export default function useAuxiliaryCatalogRefresh(refresh, contextId) {
  const current = useRef(refresh);
  current.current = refresh;
  useEffect(() => {
    if (!contextId) return undefined;
    let running = false;
    const update = async () => {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try { await current.current(); } finally { running = false; }
    };
    window.addEventListener('focus', update);
    window.addEventListener(SHARED_CATALOG_CHANGED, update);
    document.addEventListener('visibilitychange', update);
    const timer = window.setInterval(update, 60000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
      window.removeEventListener(SHARED_CATALOG_CHANGED, update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [contextId]);
}
