export const BACKUP_FORMAT = 'SACRAMENTUM_PERSONAL_BACKUP';
export const BACKUP_MAX_FILE_SIZE = 18 * 1024 * 1024;

export function validateBackup(value, role) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.format !== BACKUP_FORMAT || value.version !== 1
    || typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt))
    || typeof value.sealed !== 'string' || value.sealed.length < 64
    || value.sealed.length > 17 * 1024 * 1024
    || !/^[a-f0-9]{64}$/.test(value.integrity || '')) {
    throw new Error('Seleccione un archivo de copia de seguridad de SACRAMENTUM.');
  }
  if (value.role !== role) throw new Error('La copia corresponde a otro rol.');
  const { format, version, exportedAt, sealed, integrity } = value;
  return { format, version, role, exportedAt, sealed, integrity };
}

export function downloadBackup(file) {
  const date = file.exportedAt.slice(0, 19).replace(/:/g, '-');
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sacramentum-${file.role}-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
