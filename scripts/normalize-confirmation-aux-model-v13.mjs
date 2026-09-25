
import fs from 'node:fs';

function replace(file, oldText, newText) {
  let s = fs.readFileSync(file,'utf8');
  if (!s.includes(oldText)) throw new Error('No match in '+file+' for '+oldText.slice(0,80));
  s = s.replace(oldText,newText);
  fs.writeFileSync(file,s);
  console.log('PATCHED',file);
}

function removeDatalist(file, id) {
  let s=fs.readFileSync(file,'utf8');
  const re=new RegExp('\\s*<datalist id="'+id+'">[\\s\\S]*?<\\/datalist>\\s*','m');
  if(!re.test(s)){ console.log('NO_DATALIST',file,id); return; }
  s=s.replace(re,'\n');
  fs.writeFileSync(file,s);
  console.log('REMOVED_DATALIST',file,id);
}

const root='C:/SACRAMENTUM/SACRAMENTUM_FINAL/';

removeDatalist(root+'src/pages/parish/BaptismNewPage.jsx','lista-parrocos');
removeDatalist(root+'src/pages/parish/BaptismCelebratedPage.jsx','lista-parrocos');
removeDatalist(root+'src/pages/parish/ConfirmationNewPage.jsx','lista-parrocos');
removeDatalist(root+'src/pages/parish/MatrimonioNewPage.jsx','matrimonio-sacerdotes');
removeDatalist(root+'src/pages/parish/MatrimonioCelebratedPage.jsx','matrimonio-historico-sacerdotes');
removeDatalist(root+'src/pages/parish/FuneralRegistryPage.jsx','exequias-sacerdotes');

replace(
  root+'src/pages/parish/MatrimonioNewPage.jsx',
`                            <input 
                                type="text" 
                                name="presenciaria" 
                                value={formData.presenciaria} 
                                onChange={handleChange} 
                                list="matrimonio-sacerdotes"
                                placeholder="Nombre del sacerdote o diácono"
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-slate-900 bg-white uppercase" 
                            />`,
`                            <AuxiliaryAutocomplete
                                name="presenciaria"
                                value={formData.presenciaria}
                                onChange={handleChange}
                                options={auxiliaries.priestOptions}
                                placeholder="PÁRROCO ACTUAL U OTRO SACERDOTE / DIÁCONO..."
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4B7BA7] outline-none text-slate-900 bg-white uppercase"
                            />`
);

replace(
  root+'src/pages/parish/FuneralRegistryPage.jsx',
`                    <Input
                      value={form.ministro}
                      list="exequias-sacerdotes"
                      onChange={(e) => set('ministro', e.target.value.toUpperCase())}
                    />`,
`                    <AuxiliaryAutocomplete
                      name="ministro"
                      value={form.ministro}
                      onChange={(e) => set('ministro', e.target.value.toUpperCase())}
                      options={auxiliaries.priestOptions}
                      placeholder="PÁRROCO ACTUAL U OTRO SACERDOTE..."
                      className="w-full h-10 px-3 py-2 border border-slate-300 rounded-xl bg-white uppercase"
                    />`
);

replace(
  root+'src/pages/parish/FuneralRegistryPage.jsx',
`                    <Input
                      value={historical.ministro}
                      list="exequias-sacerdotes"
                      onChange={(e) => setHistoricalField('ministro', e.target.value.toUpperCase())}
                    />`,
`                    <AuxiliaryAutocomplete
                      name="historical_ministro"
                      value={historical.ministro}
                      onChange={(e) => setHistoricalField('ministro', e.target.value.toUpperCase())}
                      options={auxiliaries.priestOptions}
                      placeholder="SUGERIDO SEGÚN LA FECHA · PUEDE CORREGIRSE"
                      className="w-full h-10 px-3 py-2 border border-slate-300 rounded-xl bg-white uppercase"
                    />`
);

replace(
  root+'src/pages/parish/FuneralRegistryPage.jsx',
`                    <Input
                      value={historical.da_fe}
                      list="exequias-sacerdotes"
                      onChange={(e) => setHistoricalField('da_fe', e.target.value.toUpperCase())}
                    />`,
`                    <AuxiliaryAutocomplete
                      name="historical_da_fe"
                      value={historical.da_fe}
                      onChange={(e) => setHistoricalField('da_fe', e.target.value.toUpperCase())}
                      options={auxiliaries.priestOptions}
                      placeholder="PÁRROCO VIGENTE EN ESA FECHA · PUEDE CORREGIRSE"
                      className="w-full h-10 px-3 py-2 border border-slate-300 rounded-xl bg-white uppercase"
                    />`
);

console.log('DONE');
