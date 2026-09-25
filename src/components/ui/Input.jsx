import React from 'react';

const Input = React.forwardRef(({ className, error, name, ...props }, ref) => {
  // Special handling for ministerFaith field - Read Only and Specific Styling
  const isMinisterFaith = name === 'ministerFaith';
  const displayProps = isMinisterFaith ? { readOnly: true, tabIndex: -1, ...props } : props;
  
  return (
    <div className="w-full">
      <input
        ref={ref}
        name={name}
        className={`flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B7BA7] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100 ${isMinisterFaith ? 'bg-slate-100 text-slate-700 cursor-default font-bold border-slate-300 focus:ring-0' : ''} ${className}`}
        {...displayProps}
      />
      {error && <p className="text-xs text-red-600 mt-1 font-semibold">{error}</p>}
    </div>
  );
});
Input.displayName = 'Input';

export { Input };
export default Input;