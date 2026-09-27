import fs from 'node:fs';
import path from 'node:path';
import {
  LEGACY_IMPORT_PROFILES,
  analyzeLegacyRow,
} from '../../src/config/legacyImportProfiles.js';

const [, , canonicalRoot = 'D:/SACRAMENTA_CANONICAL_EXPORT', chunkRoot = 'D:/SACRAMENTA_CANONICAL_CHUNKS'] = process.argv;
const manifest = JSON.parse(fs.readFileSync(path.join(canonicalRoot, 'manifest.json'), 'utf8'));

if (fs.existsSync(chunkRoot)) fs.rmSync(chunkRoot, { recursive: true, force: true });
fs.mkdirSync(chunkRoot, { recursive: true });

const chunkSize = 450;
const plan = {
  schemaVersion: 'sacramentum-legacy-ingest-plan-v1',
  generatedAt: new Date().toISOString(),
  canonicalRoot,
  files: [],
  chunks: [],
  totals: { files: 0, rows: 0, chunks: 0, deleted: 0, review: 0, error: 0 },
};
for (const fileMeta of manifest.files) {
  const canonicalFile = path.join(canonicalRoot, fileMeta.output);
  const payload = JSON.parse(fs.readFileSync(canonicalFile, 'utf8'));
  const profileKey = LEGACY_IMPORT_PROFILES[payload.profileKey]
    ? payload.profileKey
    : 'LEGACY_ARCHIVE';

  const analyzed = payload.data.map((row, index) => {
    const result = analyzeLegacyRow(profileKey, row, index);
    if (row._deleted === true) {
      result.status = 'skipped';
      result.issue_codes = [...new Set([...(result.issue_codes || []), 'LEGACY_DELETED_PRESERVED'])];
      result.issue_details = {
        ...(result.issue_details || {}),
        deleted: true,
      };
    }
    return result;
  });

  const keyCounts = new Map();
  for (const row of analyzed) {
    keyCounts.set(row.source_key, (keyCounts.get(row.source_key) || 0) + 1);
  }
  for (const row of analyzed) {
    if ((keyCounts.get(row.source_key) || 0) > 1) {
      row.source_key = `${row.source_key}|ROW:${row.row_number}`;
      row.issue_codes = [...new Set([...(row.issue_codes || []), 'DUPLICATE_LOGICAL_KEY_PRESERVED'])];
    }
  }
  const totalChunks = Math.max(1, Math.ceil(analyzed.length / chunkSize));
  const filePlan = {
    originKey: payload.originKey,
    relativePath: payload.relativePath,
    filename: payload.sourceFilename,
    profileKey,
    sourceSha256: payload.sourceSha256,
    memoFilename: payload.memoFilename,
    memoSha256: payload.memoSha256,
    rowCount: payload.data.length,
    activeRows: payload.activeRows,
    deletedRows: payload.deletedRows,
    fields: payload.fields,
    totalChunks,
    chunks: [],
  };

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const rows = analyzed.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize);
    const chunkName = [
      payload.originKey,
      path.basename(payload.sourceFilename, path.extname(payload.sourceFilename)).toLowerCase(),
      String(chunkIndex + 1).padStart(3, '0'),
      'of',
      String(totalChunks).padStart(3, '0'),
    ].join('__') + '.json';
    const chunkPayload = {
      file: {
        originKey: payload.originKey,
        relativePath: payload.relativePath,
        filename: payload.sourceFilename,
        profileKey,
        sourceSha256: payload.sourceSha256,
        memoFilename: payload.memoFilename,
        memoSha256: payload.memoSha256,
        rowCount: payload.data.length,
        activeRows: payload.activeRows,
        deletedRows: payload.deletedRows,
        fields: payload.fields,
      },
      chunkIndex,
      totalChunks,
      rows,
    };

    const chunkPath = path.join(chunkRoot, chunkName);
    fs.writeFileSync(chunkPath, JSON.stringify(chunkPayload), 'utf8');
    filePlan.chunks.push(chunkName);
    plan.chunks.push(chunkName);
    plan.totals.chunks += 1;
    plan.totals.rows += rows.length;
    plan.totals.deleted += rows.filter((row) => row.original_data?._deleted === true).length;
    plan.totals.review += rows.filter((row) => row.status === 'review').length;
    plan.totals.error += rows.filter((row) => row.status === 'error').length;
  }

  plan.files.push(filePlan);
  plan.totals.files += 1;
}
fs.writeFileSync(path.join(chunkRoot, 'plan.json'), JSON.stringify(plan, null, 2), 'utf8');

console.log(JSON.stringify({
  canonicalRoot,
  chunkRoot,
  totals: plan.totals,
  origins: [...new Set(plan.files.map((file) => file.originKey))],
  profiles: [...new Set(plan.files.map((file) => file.profileKey))].sort(),
}, null, 2));
