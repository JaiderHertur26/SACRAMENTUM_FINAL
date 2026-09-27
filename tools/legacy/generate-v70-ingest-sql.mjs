import fs from 'node:fs';
import path from 'node:path';

const [, , canonicalRoot, installationId, actorUserId, outputDirArg] = process.argv;
if (!canonicalRoot || !installationId || !actorUserId) {
  console.error('Uso: node generate-v70-ingest-sql.mjs <canonicalRoot> <installationId> <actorUserId> [outputDir]');
  process.exit(2);
}

const outputDir = outputDirArg || path.join(canonicalRoot, 'v70-sql');
const manifestPath = path.join(canonicalRoot, 'manifest.json');
if (!fs.existsSync(manifestPath)) throw new Error(`No existe ${manifestPath}`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const sqlString = (value) => `'${String(value ?? '').replace(/'/g, "''")}'`;
const jsonSql = (value) => `${sqlString(JSON.stringify(value))}::jsonb`;

const MAX_ROWS_PER_CALL = 200;
const MAX_FILE_BYTES = 2_500_000;
let part = 1;
let statements = [];
let bytes = 0;
let calls = 0;
let rows = 0;
const emitted = [];

const header = () => [
  'begin;',
  'set local role authenticated;',
  `select set_config('request.jwt.claim.sub', ${sqlString(actorUserId)}, true);`,
  '',
];

const flush = () => {
  if (!statements.length) return;
  const name = `v70_ingest_${String(part).padStart(3, '0')}.sql`;
  const full = path.join(outputDir, name);
  const content = [...header(), ...statements, '', 'commit;', ''].join('\n');
  fs.writeFileSync(full, content, 'utf8');
  emitted.push({ name, bytes: Buffer.byteLength(content), calls, rows });
  part += 1;
  statements = [];
  bytes = 0;
  calls = 0;
  rows = 0;
};
for (const entry of manifest.files) {
  const payloadPath = path.join(canonicalRoot, entry.output.replace(/\//g, path.sep));
  const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  const artifact = {
    schemaVersion: payload.schemaVersion,
    sourceArchive: payload.sourceArchive,
    originKey: payload.originKey,
    relativePath: payload.relativePath,
    sourceFilename: payload.sourceFilename,
    profileKey: payload.profileKey,
    sourceSha256: payload.sourceSha256,
    memoFilename: payload.memoFilename,
    memoSha256: payload.memoSha256,
    headerRecordCount: payload.headerRecordCount,
    declaredRecordCount: payload.declaredRecordCount,
    activeRows: payload.activeRows,
    deletedRows: payload.deletedRows,
    headerLength: payload.headerLength,
    recordLength: payload.recordLength,
    versionByte: payload.versionByte,
    parseStatus: payload.parseStatus,
    parseReason: payload.parseReason,
    fields: payload.fields,
  };

  const rowChunks = [];
  if (!payload.data.length) rowChunks.push([]);
  for (let i = 0; i < payload.data.length; i += MAX_ROWS_PER_CALL) {
    rowChunks.push(payload.data.slice(i, i + MAX_ROWS_PER_CALL));
  }

  for (const rowChunk of rowChunks) {
    const originExpr = `(select id from public.legacy_source_origins where source_installation_id=${sqlString(installationId)}::uuid and origin_key=${sqlString(payload.originKey)} limit 1)`;
    const parseReasonSql = payload.parseReason == null
      ? 'null'
      : sqlString(payload.parseReason);
    const declaredCountSql = payload.declaredRecordCount == null
      ? 'null'
      : String(Number(payload.declaredRecordCount));
    const versionByteSql = payload.versionByte == null
      ? 'null'
      : String(Number(payload.versionByte));

    const stmt = [
      'select public.ingest_legacy_physical_artifact_v70(',
      `  ${sqlString(installationId)}::uuid,`,
      `  ${originExpr},`,
      `  ${jsonSql(artifact)},`,
      `  ${jsonSql(rowChunk)}`,
      ');',
      'select public.annotate_legacy_physical_artifact_v71(',
      `  ${sqlString(installationId)}::uuid,`,
      `  ${originExpr},`,
      `  ${sqlString(payload.relativePath)},`,
      `  ${sqlString(payload.sourceSha256)},`,
      `  ${sqlString(payload.parseStatus || 'parsed')},`,
      `  ${parseReasonSql},`,
      `  ${declaredCountSql},`,
      `  ${versionByteSql}`,
      ');',
      ''
    ].join('\n');

    const stmtBytes = Buffer.byteLength(stmt);
    if (statements.length && bytes + stmtBytes > MAX_FILE_BYTES) flush();
    statements.push(stmt);
    bytes += stmtBytes;
    calls += 1;
    rows += rowChunk.length;
  }
}
flush();

const summary = {
  schemaVersion: manifest.schemaVersion,
  installationId,
  actorUserId,
  sourceArchive: manifest.sourceArchive,
  artifactCount: manifest.files.length,
  manifestRows: manifest.totalRows,
  sqlParts: emitted.length,
  calls: emitted.reduce((s, x) => s + x.calls, 0),
  rows: emitted.reduce((s, x) => s + x.rows, 0),
  files: emitted,
};

fs.writeFileSync(path.join(outputDir, 'ingest-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
