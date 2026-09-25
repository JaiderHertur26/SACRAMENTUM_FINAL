import React, { useMemo } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import AuxiliaryAutocomplete from '@/components/AuxiliaryAutocomplete';

const ChurchLocationAutocomplete = ({
  value = '',
  onChange,
  name = 'church_location',
  placeholder = 'ESCRIBA PARROQUIA, IGLESIA O LUGAR...',
  disabled = false,
  className = '',
  churches = null,
  cities = null,
  parishName = ''
}) => {
  const { user } = useAuth();
  const { getIglesiasList, getCiudadesList } = useAppData();

  const options = useMemo(() => {
    const contextId = user?.parish_id || user?.parishId || user?.diocese_id || user?.dioceseId || null;
    const sourceChurches = Array.isArray(churches)
      ? churches
      : (contextId ? (getIglesiasList(contextId) || []) : []);
    const sourceCities = Array.isArray(cities)
      ? cities
      : (contextId ? (getCiudadesList(contextId) || []) : []);

    const values = [
      parishName,
      ...sourceChurches.flatMap((item) => {
        const churchName = String(item?.nombre || item?.name || '').trim();
        const cityName = String(item?.ciudad || item?.municipio || item?.city || '').trim();
        if (!churchName) return [];
        return cityName
          ? [churchName, `${churchName} - ${cityName}`]
          : [churchName];
      }),
      ...sourceCities.map((item) =>
        typeof item === 'string' ? item : (item?.nombre || item?.name || '')
      )
    ]
      .map((item) => String(item || '').trim().toUpperCase())
      .filter(Boolean);

    return [...new Set(values)];
  }, [user, churches, cities, parishName, getIglesiasList, getCiudadesList]);

  const handleChange = (event) => {
    const next = event?.target?.value ?? '';
    onChange?.(next);
  };

  return (
    <AuxiliaryAutocomplete
      name={name}
      value={value}
      onChange={handleChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      maxResults={10}
    />
  );
};

export default ChurchLocationAutocomplete;
