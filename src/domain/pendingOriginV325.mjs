const parse = value => {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { throw new Error('No se pudo verificar el origen del pendiente.'); }
  }
  return value && typeof value === 'object' ? value : {};
};
export function isDecreePendingV325(record) {
  const row = parse(record), raw = parse(row.raw_data || row.rawData || row.raw);
  return [row, raw].some(value =>
    /^chancery_pending_seat_/i.test(String(value.recordOrigin || value.record_origin || '')) ||
    ['chancery_decree','decree','decree_supplement','new_decree_supplement'].includes(String(value.source || '').toLowerCase()) ||
    [value.decreeId,value.decree_id,value.decretoId,value.decreto_id].some(id => String(id || '').trim().length > 0)
  );
}
export const isOrdinaryPendingV325 = record => !isDecreePendingV325(record);
