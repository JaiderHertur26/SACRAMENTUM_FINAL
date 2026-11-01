import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import AuxiliaryAutocomplete from '@/components/AuxiliaryAutocomplete';
import { readSharedAuxiliaryCatalog } from '@/services/sharedAuxiliaryCatalogService';
import useAuxiliaryCatalogRefresh from '@/hooks/useAuxiliaryCatalogRefresh';

const upper = (value='') => String(value || '').trim().toUpperCase();

const directoryLabel = (row={}) => {
  const diocese = Array.isArray(row.diocese) ? row.diocese[0] : row.diocese;
  return [
    row.name,
    row.city,
    diocese?.name
  ].map(upper).filter(Boolean).join(' - ');
};

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
  const [directoryOptions, setDirectoryOptions] = useState([]);
  const contextId = user?.parish_id || user?.parishId || user?.diocese_id || user?.dioceseId || null;
  const [shared, setShared] = useState({ contextId: null, churches: [], cities: [] });
  const loadShared = async () => {
    if (!contextId || (Array.isArray(churches) && Array.isArray(cities))) return;
    try {
      const [churchRows, cityRows] = await Promise.all([
        Array.isArray(churches) ? churches : readSharedAuxiliaryCatalog('iglesias', contextId),
        Array.isArray(cities) ? cities : readSharedAuxiliaryCatalog('ciudades', contextId)
      ]);
      setShared({ contextId, churches: churchRows, cities: cityRows });
    } catch {
      setShared({ contextId, churches: [], cities: [] });
    }
  };
  useEffect(() => { loadShared(); }, [contextId, churches, cities]);
  useAuxiliaryCatalogRefresh(loadShared, contextId);

  useEffect(() => {
    if (disabled) {
      setDirectoryOptions([]);
      return undefined;
    }

    const raw = String(value || '').trim();
    const query = raw
      .replace(/[,%_()"'\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

    if (query.length < 2) {
      setDirectoryOptions([]);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from('directory_churches')
        .select('name,city,diocese:directory_dioceses(name)')
        .or(`name.ilike.%${query}%,city.ilike.%${query}%`)
        .order('name', { ascending: true })
        .limit(25);

      if (cancelled) return;
      if (error) {
        console.warn('No fue posible consultar el directorio eclesial:', error);
        setDirectoryOptions([]);
        return;
      }

      setDirectoryOptions((data || []).map(directoryLabel).filter(Boolean));
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, disabled]);

  const options = useMemo(() => {
    const sourceChurches = Array.isArray(churches)
      ? churches
      : (shared.contextId === contextId ? shared.churches : []);
    const sourceCities = Array.isArray(cities)
      ? cities
      : (shared.contextId === contextId ? shared.cities : []);

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
      ),
      ...directoryOptions
    ]
      .map(upper)
      .filter(Boolean);

    return [...new Set(values)];
  }, [contextId, shared, churches, cities, parishName, directoryOptions]);

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
      maxResults={12}
    />
  );
};

export default ChurchLocationAutocomplete;
