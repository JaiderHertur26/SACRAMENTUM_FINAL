import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Search } from 'lucide-react';

const AuxiliaryAutocomplete = ({
  name,
  value = '',
  onChange,
  options = [],
  placeholder = '',
  className = '',
  disabled = false,
  maxResults = 10
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const normalizedOptions = useMemo(
    () => [...new Set((options || []).map((x) => String(x || '').trim()).filter(Boolean))],
    [options]
  );

  const filtered = useMemo(() => {
    const q = String(value || '').trim().toLowerCase();
    if (!q) return normalizedOptions.slice(0, maxResults);
    return normalizedOptions
      .filter((item) => item.toLowerCase().includes(q))
      .slice(0, maxResults);
  }, [value, normalizedOptions, maxResults]);
  useEffect(() => {
    const handle = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const emit = (next) => {
    onChange?.({
      target: {
        name,
        value: next,
        type: 'text'
      }
    });
  };

  return (
    <div className="relative w-full" ref={ref}>
      <div className="relative">
        <input
          type="text"
          name={name}
          value={value}
          disabled={disabled}
          autoComplete="off"
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => { emit(e.target.value); setOpen(true); }}
          className={className}
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { emit(option); setOpen(false); }}
              className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#4B7BA7]"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuxiliaryAutocomplete;
