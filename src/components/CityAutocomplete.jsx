import React, { useMemo } from 'react';
import AuxiliaryAutocomplete from '@/components/AuxiliaryAutocomplete';

const CityAutocomplete = ({
  cities = [],
  value = '',
  onChange,
  name = 'city',
  placeholder = 'EMPIECE A ESCRIBIR LA CIUDAD...',
  className = '',
  disabled = false
}) => {
  const options = useMemo(
    () => [...new Set(
      (cities || [])
        .map((c) => String(typeof c === 'string' ? c : (c?.nombre || c?.name || '')).trim().toUpperCase())
        .filter(Boolean)
    )],
    [cities]
  );

  return (
    <AuxiliaryAutocomplete
      name={name}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      maxResults={10}
    />
  );
};

export default CityAutocomplete;
