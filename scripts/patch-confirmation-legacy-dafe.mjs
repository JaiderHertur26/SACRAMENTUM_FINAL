import fs from 'node:fs';

const file = 'src/services/sacramentsService.js';
let s = fs.readFileSync(file, 'utf8');

const old1 = `    const daFeIsCode = /^\\d+$/.test(String(rawDaFe || '').trim());
    return {`;
const new1 = `    const daFeIsCode = /^\\d+$/.test(String(rawDaFe || '').trim());
    const legacyDaFeCode = String(payload.legacy_dafe_code || legacy.legacy_dafe_code || (daFeIsCode ? rawDaFe : '') || '').trim();
    const resolvedLegacyDaFe = String(payload.legacy_dafe_resolved_name || legacy.legacy_dafe_resolved_name || '').trim();
    return {`;
if (!s.includes(old1)) throw new Error('Bloque de resolución Da Fe no encontrado');
s = s.replace(old1, new1);

const old2 = `        daFe: daFeIsCode ? '' : String(rawDaFe || '').trim().toUpperCase(),
        legacyDaFeCode: daFeIsCode ? String(rawDaFe).trim() : (legacy.legacy_dafe_code || ''),`;
const new2 = `        daFe: daFeIsCode ? resolvedLegacyDaFe.toUpperCase() : String(rawDaFe || '').trim().toUpperCase(),
        legacyDaFeCode,`;
if (!s.includes(old2)) throw new Error('Asignación Da Fe no encontrada');
s = s.replace(old2, new2);

fs.writeFileSync(file, s, 'utf8');
console.log('PATCH_DAFE_FRONTEND_OK');
