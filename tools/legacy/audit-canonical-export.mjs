import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || 'D:/SACRAMENTA_CANONICAL_EXPORT';
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

const byOriginProfile = {};
for (const file of manifest.files) {
  const key = `${file.originKey}|${file.profileKey}`;
  byOriginProfile[key] ||= { files: 0, rows: 0, active: 0, deleted: 0 };
  byOriginProfile[key].files += 1;
  byOriginProfile[key].rows += file.rows;
  byOriginProfile[key].active += file.activeRows;
  byOriginProfile[key].deleted += file.deletedRows;
}

console.log('=== COBERTURA POR ORIGEN/PERFIL ===');
for (const [key, value] of Object.entries(byOriginProfile).sort()) {
  console.log(key, JSON.stringify(value));
}
console.log('\n=== DUPLICADOS FÍSICOS ENTRE ORÍGENES ===');
for (const group of manifest.duplicatePhysicalFiles) {
  const origins = [...new Set(group.members.map((m) => m.originKey))];
  if (origins.length > 1) {
    console.log(group.sha256.slice(0, 16), group.members.map((m) => `${m.originKey}:${m.relativePath}`).join(' | '));
  }
}

const certFile = path.join(root, 'origins', 'pquia001', 'CERTIFICADOS.json');
const cert = JSON.parse(fs.readFileSync(certFile, 'utf8'));
const withTemplate = cert.data.find((row) => String(row.plantilla || '').trim());
console.log('\n=== MEMO CERTIFICADOS ===');
console.log('texto_largo_chars=', String(withTemplate?.plantilla || '').length);
console.log(String(withTemplate?.plantilla || '').slice(0, 320).replace(/\s+/g, ' '));

const anulFile = path.join(root, 'origins', 'pquia004', 'ANULACION.json');
if (fs.existsSync(anulFile)) {
  const anul = JSON.parse(fs.readFileSync(anulFile, 'utf8'));
  console.log('\n=== MEMO ANULACION PQUIA004 ===');
  for (const row of anul.data.filter((r) => String(r.observacio || '').trim()).slice(0, 3)) {
    console.log(row._row_number, String(row.observacio).slice(0, 220).replace(/\s+/g, ' '));
  }
}
console.log('\n=== ARTEFACTOS NO PARSEABLES COMO DBF ===');
const unparsed = manifest.files.filter((file) => file.parseStatus === 'binary_unparsed');
if (!unparsed.length) console.log('Ninguno');
for (const file of unparsed) {
  console.log(file.originKey, file.relativePath, file.parseReason || 'sin_razon');
}

console.log('\n=== RESUMEN ===');
console.log(JSON.stringify({
  dbfCount: manifest.dbfCount,
  totalRows: manifest.totalRows,
  totalActiveRows: manifest.totalActiveRows,
  totalDeletedRows: manifest.totalDeletedRows,
  parsedDbf: manifest.files.filter((file) => file.parseStatus === 'parsed').length,
  binaryUnparsed: unparsed.length,
  origins: manifest.origins,
  crossOriginDuplicateGroups: manifest.duplicatePhysicalFiles.filter((g) => new Set(g.members.map((m) => m.originKey)).size > 1).length,
}, null, 2));
