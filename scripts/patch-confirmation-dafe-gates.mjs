import fs from 'node:fs';

const verify = 'scripts/verify-confirmation-closure.mjs';
let v = fs.readFileSync(verify, 'utf8');
const anchor = `if (!/fetchConfirmationsFromSource/.test(svc)) issues.push('Falta fetchConfirmationsFromSource canónico');`;
const added = `${anchor}\nif (!/legacy_dafe_resolved_name/.test(svc) || !/legacyDaFeCode/.test(svc)) issues.push('Confirmación legacy: Da Fe no conserva resolución + código original');`;
if (!v.includes(anchor)) throw new Error('Anchor verify no encontrado');
if (!v.includes('Da Fe no conserva resolución + código original')) v = v.replace(anchor, added);
fs.writeFileSync(verify, v, 'utf8');
console.log('VERIFY_DAFE_GATE_OK');
