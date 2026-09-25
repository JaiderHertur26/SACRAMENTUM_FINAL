import { useEffect, useState } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';

const useParroquiaFromMisDatos = () => {
  const { user } = useAuth();
  const { getMisDatosList } = useAppData();
  const [parishName, setParishName] = useState('');

  useEffect(() => {
    if (user?.parishId) {
      const misDatos = getMisDatosList(user.parishId);
      if (misDatos && misDatos.length > 0 && misDatos[0].nombre) {
        setParishName(misDatos[0].nombre);
      } else if (user.parishName) {
        setParishName(user.parishName);
      }
    } else if (user?.parishName) {
        setParishName(user.parishName);
    }
  }, [user, getMisDatosList]);

  return parishName;
};

export default useParroquiaFromMisDatos;