import fs from 'node:fs';
const p='supabase/applied-history/SACRAMENTUM_LEGACY_IMPORT_RELATIONAL_V2.sql';
let s=fs.readFileSync(p,'utf8');
const a="  return jsonb_build_object('matched',v_matched,'unmatched',v_unmatched,'ambiguous',v_ambiguous);\nend;\n$$;";
const b="  perform public.refresh_legacy_directory_links();\n  return jsonb_build_object('matched',v_matched,'unmatched',v_unmatched,'ambiguous',v_ambiguous);\nend;\n$$;";
if(!s.includes(a)) throw new Error('retorno reconcile no encontrado');
s=s.replace(a,b);
fs.writeFileSync(p,s,'utf8');
console.log('PATCH_DIRECTORY_REFRESH_OK');
