const normalize = (value) => String(value ?? '').trim().toLowerCase();

const STATUS_LABELS = Object.freeze({
  active: 'Activo',
  inactive: 'Inactivo',
  pending: 'Pendiente',
  unread: 'No leída',
  seated: 'Asentada',
  confirmed: 'Confirmado',
  generated: 'Generado',
  sent: 'Enviado',
  received: 'Recibido',
  processed: 'Procesado',
  valid: 'Válido',
  review: 'Revisar',
  imported: 'Importado',
  completed: 'Completado',
  failed: 'Error',
  error: 'Error',
  reversed: 'Revertida',
  annulled: 'Anulada',
  nullified: 'Anulada',
  replaced: 'Reemplazada',
  ordinary: 'Ordinario',
  ordinario: 'Ordinario',
  supplementary: 'Supletorio',
  supletorio: 'Supletorio',
});

const PRINT_POLICY_LABELS = Object.freeze({
  required: 'Obligatoria',
  internal: 'Interna',
  optional: 'Opcional',
  never: 'No imprimir',
});

export const labelStatus = (value, fallback = 'Sin estado') => {
  const key = normalize(value);
  if (!key) return fallback;
  return STATUS_LABELS[key] || String(value);
};

export const labelPrintPolicy = (value) => {
  const key = normalize(value);
  return PRINT_POLICY_LABELS[key] || (value ? String(value) : 'Opcional');
};

export const labelMigrationStatus = (value) => labelStatus(value, 'Sin estado');
