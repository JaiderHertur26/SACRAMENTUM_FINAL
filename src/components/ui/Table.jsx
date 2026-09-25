import React from 'react';
import { Button } from './button';
import { Pencil, Trash2 } from 'lucide-react';

const Table = ({ columns, data, actions, onAction, onEdit, onDelete, onRowClick, rowClassName }) => {
  // Determine if we need to render the Actions column
  const showActions = (actions && actions.length > 0) || onEdit || onDelete;
  // Ensure data is always an array to prevent crashes
  const safeData = Array.isArray(data) ? data : [];

  // Helper to resolve dynamic properties that can be values or functions
  const resolveProp = (prop, row) => {
    if (typeof prop === 'function') {
      return prop(row);
    }
    return prop;
  };

  return (
    <div className="w-full overflow-auto rounded-lg border border-slate-200 shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className="px-4 py-3 align-middle whitespace-nowrap">{col.header}</th>
            ))}
            {showActions && <th className="px-4 py-3 text-right align-middle whitespace-nowrap">Acciones</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {safeData.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (showActions ? 1 : 0)} className="px-4 py-8 text-center text-slate-900 font-medium">
                No hay registros disponibles.
              </td>
            </tr>
          ) : (
            safeData.map((row, rowIdx) => (
              <tr 
                key={row.id || rowIdx} 
                className={`${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${onRowClick ? 'cursor-pointer hover:bg-blue-50 transition-colors' : ''} ${resolveProp(rowClassName, row) || ''}`}
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="px-4 py-3 align-middle text-slate-900 font-medium">
                    {/* Render custom cell content if 'render' function is provided, otherwise raw value */}
                    {col.render ? col.render(row) : row[col.accessor]}
                  </td>
                ))}
                {showActions && (
                  <td className="px-4 py-3 text-right align-middle whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      {/* Generic Actions Array Support */}
                      {actions && actions.map((action, actionIdx) => {
                        const resolvedLabel = resolveProp(action.label, row);
                        const resolvedClassName = resolveProp(action.className, row);
                        const resolvedTitle = resolveProp(action.title, row);
                        const resolvedDisabled = resolveProp(action.disabled, row);
                        const resolvedIcon = resolveProp(action.icon, row);

                        return (
                          <Button
                            key={actionIdx}
                            variant={action.variant || 'ghost'}
                            size="sm"
                            onClick={(e) => {
                              if (resolvedDisabled) { e.preventDefault(); return; }
                              e.stopPropagation();
                              // Prioritize action-specific onClick, then fall back to generic onAction
                              if (action.onClick) {
                                  action.onClick(row, e);
                              } else if (onAction) {
                                  onAction(action.type, row);
                              }
                            }}
                            disabled={resolvedDisabled}
                            className={resolvedClassName}
                            title={typeof resolvedTitle === 'string' ? resolvedTitle : undefined}
                          >
                            {/* Support for 'icon' property (Component or Element) */}
                            {resolvedIcon && (React.isValidElement(resolvedIcon) ? resolvedIcon : (
                                typeof resolvedIcon === 'function' || typeof resolvedIcon === 'object' ? 
                                React.createElement(resolvedIcon, { className: "w-4 h-4" }) : null
                            ))}
                            
                            {/* Support for 'label' property (Text or Element) - only if icon wasn't the sole content */}
                            {!resolvedIcon && resolvedLabel}
                          </Button>
                        );
                      })}

                      {/* Explicit Edit Button */}
                      {onEdit && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(row);
                            }} 
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 h-auto font-semibold transition-colors"
                            title="Editar"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Editar</span>
                        </Button>
                      )}

                      {/* Explicit Delete Button */}
                      {onDelete && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(row);
                            }} 
                            className="flex items-center gap-1 text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 h-auto font-semibold transition-colors"
                            title="Eliminar"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar</span>
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;