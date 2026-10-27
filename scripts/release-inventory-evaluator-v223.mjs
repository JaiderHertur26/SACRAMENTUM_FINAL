// V223: pure evaluator of exact, privileged SELECT-only counts.
// Reference content must still be reviewed, never copied from QA; only controlled migrations seed it.
export const SYSTEM_REFERENCE_TABLES = Object.freeze([
 'public.legacy_import_profiles',
 'public.document_templates',
 'public.marginal_note_templates',
 'public.marginal_note_template_clauses',
]);

export function evaluateEmptyLaunchInventory(rows, manifest) {
 const expected = (manifest?.tables || []).map(name=>'public.'+name);
 if (!expected.length || new Set(expected).size!==expected.length) throw new Error('Inventario canónico ausente o duplicado');
 const expectedObjects = [...expected,'auth.users','storage.objects','storage.buckets'];
 const actual = new Map();
 for (const item of rows || []) {
   if (!item || typeof item.object_name !== 'string'
       || !Number.isSafeInteger(Number(item.rows_count)) || Number(item.rows_count)<0
       || actual.has(item.object_name)) throw new Error('Dato incompleto, inválido o duplicado del censo');
   actual.set(item.object_name,Number(item.rows_count));
 }
 const missing = expectedObjects.filter(name=>!actual.has(name));
 const unexpected = [...actual.keys()].filter(name=>!expectedObjects.includes(name));
 const businessRows=expected.filter(name=>!SYSTEM_REFERENCE_TABLES.includes(name))
   .reduce((sum,name)=>sum+(actual.get(name)||0),0);
 const referenceRows=SYSTEM_REFERENCE_TABLES.reduce((sum,name)=>sum+(actual.get(name)||0),0);
 const authUsers=actual.get('auth.users');
 const storageObjects=actual.get('storage.objects');
 const countedPublicTables=expected.filter(name=>actual.has(name)).length;
 const clear=missing.length===0 && unexpected.length===0
  && businessRows===0 && authUsers===0 && storageObjects===0;
 return {
   clearForNewEmptyInstallation:clear,approvedForOfficialUse:false,
   expectedPublicTables:expected.length,countedPublicTables,
   missing,unexpected,businessRows,referenceRows,
   authUsers:authUsers??null,storageObjects:storageObjects??null,
   storageBuckets:actual.get('storage.buckets')??null,
   note:'Reference tables may contain schema-seeded definitions ONLY after manual audit. This evaluator never certifies data provenance or approves official use.'
 };
}
