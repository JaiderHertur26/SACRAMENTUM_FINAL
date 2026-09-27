import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [, , inputRoot, outputRoot, sourceArchive = ''] = process.argv;
if (!inputRoot || !outputRoot) {
  console.error('Uso: node dbf-canonicalizer.mjs <inputRoot> <outputRoot> [sourceArchive]');
  process.exit(2);
}

const decoder = new TextDecoder('windows-1252');
const decodeText = (buf) => decoder.decode(buf).replace(/\0/g, '').trim();
const sha256Buffer = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const sha256File = (file) => sha256Buffer(fs.readFileSync(file));
const profileAliases = {
  CFGDOCUMENTOS: 'CERTIFICADOS',
  AUDITORIA: 'LEGACY_ARCHIVE',
  ERRORES: 'LEGACY_ARCHIVE',
  FOXUSER: 'LEGACY_ARCHIVE',
  USUARIOS: 'LEGACY_ARCHIVE',
};

const profileFor = (filename) => {
  const key = path.basename(filename, path.extname(filename)).toUpperCase();
  return profileAliases[key] || key;
};

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});
const findCompanion = (dbfFile, ext) => {
  const dir = path.dirname(dbfFile);
  const base = path.basename(dbfFile, path.extname(dbfFile));
  const target = (base + ext).toLowerCase();
  const match = fs.readdirSync(dir).find((name) => name.toLowerCase() === target);
  return match ? path.join(dir, match) : null;
};

const originFor = (relativePath) => {
  const parts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
  const pquia = parts.find((part) => /^PQUIA\d{3}$/i.test(part));
  return pquia ? pquia.toLowerCase() : 'distribution_global';
};

const julianToDate = (julian) => {
  if (!Number.isFinite(julian) || julian <= 0) return null;
  const unixDays = julian - 2440588;
  const d = new Date(unixDays * 86400000);
  return Number.isNaN(d.getTime()) ? null : d;
};
const decodeDateTime = (raw) => {
  if (raw.length < 8) return '';
  const julian = raw.readInt32LE(0);
  const millis = raw.readInt32LE(4);
  const date = julianToDate(julian);
  if (!date || millis < 0 || millis >= 86400000) return raw.toString('hex');
  return new Date(date.getTime() + millis).toISOString();
};

const containsUnsafeJsonControls = (buffer) => {
  for (const byte of buffer) {
    if (byte < 0x20 && ![0x09, 0x0a, 0x0d].includes(byte)) return true;
  }
  return false;
};

const readFptMemo = (fpt, pointer) => {
  if (!fpt || !pointer || pointer < 1) return '';
  const blockSize = fpt.readUInt16BE(6) || 512;
  const offset = pointer * blockSize;
  if (offset + 8 > fpt.length) return '';
  const type = fpt.readUInt32BE(offset);
  const length = fpt.readUInt32BE(offset + 4);
  if (length < 0 || offset + 8 + length > fpt.length) return '';
  const body = fpt.subarray(offset + 8, offset + 8 + length);

  if (type !== 1) {
    return `__BINARY_FPT_TYPE_${type}__:${body.toString('base64')}`;
  }

  if (containsUnsafeJsonControls(body)) {
    return `__BINARY_FPT_TEXT_BASE64__:${body.toString('base64')}`;
  }

  return decoder.decode(body).replace(/\0+$/g, '');
};
const decodeField = (raw, field, fpt) => {
  const type = field.type;
  if (type === 'C' || type === 'V' || type === 'Q') return decodeText(raw);
  if (type === 'D') {
    const value = decodeText(raw);
    return /^\d{8}$/.test(value)
      ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
      : value;
  }
  if (type === 'L') {
    const value = decodeText(raw).toUpperCase();
    if (['T', 'Y'].includes(value)) return true;
    if (['F', 'N'].includes(value)) return false;
    return null;
  }
  if (type === 'N' || type === 'F') return decodeText(raw);
  if (type === 'I' && raw.length >= 4) return raw.readInt32LE(0);
  if (type === 'Y' && raw.length >= 8) return Number(raw.readBigInt64LE(0)) / 10000;
  if (type === 'B' && raw.length >= 8) return raw.readDoubleLE(0);
  if (type === 'T' || type === '@') return decodeDateTime(raw);
  if (['M', 'G', 'P'].includes(type)) {
    const pointer = raw.length >= 4 ? raw.readUInt32LE(0) : Number(decodeText(raw) || 0);
    return readFptMemo(fpt, pointer);
  }
  return decodeText(raw) || raw.toString('hex');
};
const DBF_VERSION_BYTES = new Set([
  0x02, 0x03, 0x04, 0x05,
  0x30, 0x31, 0x32,
  0x43, 0x63, 0x83, 0x8b, 0xcb, 0xf5,
]);

const parseDbf = (dbfFile) => {
  const dbf = fs.readFileSync(dbfFile);
  const fptFile = findCompanion(dbfFile, '.fpt');

  if (dbf.length < 33) {
    return {
      dbf, fptFile, fields: [], rows: [], count: 0, activeRows: 0, deletedRows: 0,
      headerLength: 0, recordLength: 0, declaredRecordCount: 0,
      parseStatus: 'binary_unparsed', parseReason: 'file_too_short_for_dbf_header',
    };
  }

  const version = dbf[0];
  const declaredRecordCount = dbf.readUInt32LE(4);
  const headerLength = dbf.readUInt16LE(8);
  const recordLength = dbf.readUInt16LE(10);
  const terminator = dbf.indexOf(0x0d, 32);
  const possibleRecords = (
    recordLength > 0 && headerLength <= dbf.length
      ? Math.max(0, Math.floor((dbf.length - headerLength) / recordLength))
      : 0
  );

  const headerProblems = [];
  if (!DBF_VERSION_BYTES.has(version)) headerProblems.push('unknown_version_byte');
  if (headerLength < 33 || headerLength > dbf.length) headerProblems.push('invalid_header_length');
  if (recordLength < 1 || recordLength > dbf.length) headerProblems.push('invalid_record_length');
  if (terminator < 32 || terminator >= headerLength) headerProblems.push('missing_header_terminator');
  if (declaredRecordCount > possibleRecords + 1) headerProblems.push('declared_record_count_exceeds_file');

  if (headerProblems.length) {
    return {
      dbf, fptFile, fields: [], rows: [], count: 0, activeRows: 0, deletedRows: 0,
      headerLength, recordLength, declaredRecordCount, version,
      parseStatus: 'binary_unparsed', parseReason: headerProblems.join(','),
    };
  }

  const fields = [];
  for (let offset = 32; offset < headerLength - 1; offset += 32) {
    if (dbf[offset] === 0x0d) break;
    const name = decodeText(dbf.subarray(offset, offset + 11));
    if (!name) break;
    fields.push({
      name,
      key: name.toLowerCase(),
      type: String.fromCharCode(dbf[offset + 11]),
      length: dbf[offset + 16],
      decimals: dbf[offset + 17],
      flags: dbf[offset + 18],
    });
  }

  const describedRecordLength = 1 + fields.reduce((sum, field) => sum + Number(field.length || 0), 0);
  if (!fields.length || describedRecordLength > recordLength) {
    return {
      dbf, fptFile, fields: [], rows: [], count: 0, activeRows: 0, deletedRows: 0,
      headerLength, recordLength, declaredRecordCount, version,
      parseStatus: 'binary_unparsed',
      parseReason: !fields.length ? 'no_valid_field_descriptors' : 'field_lengths_exceed_record_length',
    };
  }

  const fpt = fptFile ? fs.readFileSync(fptFile) : null;
  const rows = [];
  let activeRows = 0;
  let deletedRows = 0;
  const count = Math.min(declaredRecordCount, possibleRecords);

  for (let index = 0; index < count; index += 1) {
    const start = headerLength + index * recordLength;
    if (start + recordLength > dbf.length) break;
    const deleted = dbf[start] === 0x2a;
    deleted ? deletedRows += 1 : activeRows += 1;

    let pos = start + 1;
    const row = {};
    for (const field of fields) {
      const raw = dbf.subarray(pos, pos + field.length);
      row[field.key] = decodeField(raw, field, fpt);
      pos += field.length;
    }
    const recordBytes = dbf.subarray(start, start + recordLength);
    row._deleted = deleted;
    row._row_number = index + 1;
    row._record_sha256 = sha256Buffer(recordBytes);
    rows.push(row);
  }

  return {
    dbf, fptFile, fields, rows, count: rows.length, activeRows, deletedRows,
    headerLength, recordLength, declaredRecordCount, version,
    parseStatus: 'parsed', parseReason: null,
  };
};
fs.mkdirSync(outputRoot, { recursive: true });
const files = walk(inputRoot).filter((file) => /\.dbf$/i.test(file)).sort();
const manifest = {
  schemaVersion: 'sacramentum-legacy-canonical-v1',
  generatedAt: new Date().toISOString(),
  sourceArchive,
  inputRoot: path.resolve(inputRoot),
  dbfCount: files.length,
  origins: {},
  files: [],
  duplicatePhysicalFiles: [],
};

for (const dbfFile of files) {
  const relativePath = path.relative(inputRoot, dbfFile).replace(/\\/g, '/');
  const originKey = originFor(relativePath);
  const profileKey = profileFor(dbfFile);
  const parsed = parseDbf(dbfFile);
  const dbfHash = sha256Buffer(parsed.dbf);
  const memoHash = parsed.fptFile ? sha256File(parsed.fptFile) : null;
  const outDir = path.join(outputRoot, 'origins', originKey);
  fs.mkdirSync(outDir, { recursive: true });
  const stem = path.basename(dbfFile, path.extname(dbfFile)).toUpperCase();
  const outFile = path.join(outDir, `${stem}.json`);

  const payload = {
    schemaVersion: manifest.schemaVersion,
    sourceArchive,
    originKey,
    relativePath,
    sourceFilename: path.basename(dbfFile),
    profileKey,
    sourceSha256: dbfHash,
    memoFilename: parsed.fptFile ? path.basename(parsed.fptFile) : null,
    memoSha256: memoHash,
    headerRecordCount: parsed.count,
    declaredRecordCount: parsed.declaredRecordCount,
    activeRows: parsed.activeRows,
    deletedRows: parsed.deletedRows,
    headerLength: parsed.headerLength,
    recordLength: parsed.recordLength,
    versionByte: parsed.version ?? null,
    parseStatus: parsed.parseStatus,
    parseReason: parsed.parseReason,
    fields: parsed.fields,
    data: parsed.rows,
  };
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');
  manifest.origins[originKey] ||= { dbfCount: 0, rows: 0, activeRows: 0, deletedRows: 0 };
  manifest.origins[originKey].dbfCount += 1;
  manifest.origins[originKey].rows += parsed.rows.length;
  manifest.origins[originKey].activeRows += parsed.activeRows;
  manifest.origins[originKey].deletedRows += parsed.deletedRows;
  manifest.files.push({
    originKey,
    relativePath,
    profileKey,
    sourceSha256: dbfHash,
    memoSha256: memoHash,
    rows: parsed.rows.length,
    activeRows: parsed.activeRows,
    deletedRows: parsed.deletedRows,
    parseStatus: parsed.parseStatus,
    parseReason: parsed.parseReason,
    output: path.relative(outputRoot, outFile).replace(/\\/g, '/'),
  });
}

const groups = Map.groupBy(manifest.files, (file) => file.sourceSha256);
manifest.duplicatePhysicalFiles = [...groups.entries()]
  .filter(([, members]) => members.length > 1)
  .map(([sha256, members]) => ({ sha256, members }));
manifest.totalRows = manifest.files.reduce((sum, file) => sum + file.rows, 0);
manifest.totalActiveRows = manifest.files.reduce((sum, file) => sum + file.activeRows, 0);
manifest.totalDeletedRows = manifest.files.reduce((sum, file) => sum + file.deletedRows, 0);
fs.writeFileSync(path.join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(JSON.stringify({
  schemaVersion: manifest.schemaVersion,
  dbfCount: manifest.dbfCount,
  totalRows: manifest.totalRows,
  totalActiveRows: manifest.totalActiveRows,
  totalDeletedRows: manifest.totalDeletedRows,
  origins: manifest.origins,
  duplicateGroups: manifest.duplicatePhysicalFiles.length,
  outputRoot: path.resolve(outputRoot),
}, null, 2));
