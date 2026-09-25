from pathlib import Path

def rep(path, old, new):
    p=Path(path); s=p.read_text(encoding='utf-8')
    if old not in s: raise SystemExit(f'Patrón no encontrado en {p.name}: {old[:80]}')
    p.write_text(s.replace(old,new,1),encoding='utf-8')

root=Path(r'C:\SACRAMENTUM\SACRAMENTUM_FINAL\src')
cor=root/'pages/chancery/decree-correction/NewConfirmationCorrectionPage.jsx'
rep(cor,"  const [listaSacerdotes, setListaSacerdotes] = useState([]);\n  const [sacerdotePorDefecto, setSacerdotePorDefecto] = useState('');\n\n","")
rep(cor,"      setListaSacerdotes([]);\n      setSacerdotePorDefecto('');\n","")
rep(cor,"      const [{ data: params, error: paramsError }, { data: priests, error: priestsError }] = await Promise.all([\n        supabase.from('parish_parameters').select('confirmaciones_params').eq('parish_id', targetParishId).maybeSingle(),\n        supabase.from('parrocos').select('*').eq('parish_id', targetParishId).order('fecha_ingreso', { ascending: false })\n      ]);\n      if (paramsError) throw paramsError;\n      if (priestsError) throw priestsError;\n      setCloudParams(params?.confirmaciones_params || {});\n      setListaSacerdotes(priests || []);\n\n      const active = (priests || []).find(p => String(p.estado || '').toLowerCase() === '1' || String(p.estado || '').toLowerCase() === 'activo') || (priests || [])[0];\n      if (active) {\n        const name = `${active.nombre || ''} ${active.apellido || ''}`.trim().toUpperCase();\n        setSacerdotePorDefecto(name);\n        setNewPartida(prev => ({ ...prev, daFe: name }));\n      }","      const { data: params, error: paramsError } = await supabase\n        .from('parish_parameters').select('confirmaciones_params').eq('parish_id', targetParishId).maybeSingle();\n      if (paramsError) throw paramsError;\n      setCloudParams(params?.confirmaciones_params || {});")
s=cor.read_text(encoding='utf-8')
start=s.index("  // 🚀 MÁQUINA DEL TIEMPO PARA EL \"DA FE\"")
end=s.index("  // 🚀 CÁLCULO DE EDAD AUTOMÁTICO", start)
cor.write_text(s[:start]+s[end:],encoding='utf-8')
rep(cor,"      let finalDaFe = cleanTitle(newPartida.daFe);\n      finalDaFe = finalDaFe !== 'EL PÁRROCO' ? `PBRO. ${finalDaFe}` : finalDaFe;","      const rawDaFe = String(newPartida.daFe || '').trim();\n      const finalDaFe = rawDaFe ? (/^\\d+$/.test(rawDaFe) ? rawDaFe : `PBRO. ${cleanTitle(rawDaFe)}`) : '';")
rep(cor,"            daFe: dbRecord.da_fe || raw.daFe || raw.da_fe || prev.daFe,","            daFe: dbRecord.da_fe || raw.daFe || raw.da_fe || '',")

rep_page=root/'pages/chancery/decree-replacement/NewConfirmationReplacementPage.jsx'
rep(rep_page,"  const [priests, setPriests] = useState([]);\n","")
rep(rep_page,"      setParams({}); setPriests([]);","      setParams({});")
rep(rep_page,"      const [pRes, priestRes] = await Promise.all([\n        supabase.from('parish_parameters').select('confirmaciones_params').eq('parish_id', targetParishId).maybeSingle(),\n        supabase.from('parrocos').select('*').eq('parish_id', targetParishId).order('fecha_ingreso', { ascending: false })\n      ]);\n      if (pRes.error) throw pRes.error;\n      if (priestRes.error) throw priestRes.error;\n      const cfg = pRes.data?.confirmaciones_params || {};\n      setParams(cfg);\n      setPriests(priestRes.data || []);\n      const active = (priestRes.data || []).find(p => ['1','activo','active'].includes(String(p.estado || '').toLowerCase())) || (priestRes.data || [])[0];\n      if (active) {\n        const name = upper(`${active.nombre || ''} ${active.apellido || ''}`.trim());\n        setRecord(prev => ({ ...prev, daFe: name, ministro: prev.ministro || name }));\n      }","      const pRes = await supabase.from('parish_parameters').select('confirmaciones_params').eq('parish_id', targetParishId).maybeSingle();\n      if (pRes.error) throw pRes.error;\n      setParams(pRes.data?.confirmaciones_params || {});")
s=rep_page.read_text(encoding='utf-8')
start=s.index("  useEffect(() => {\n    if (!decree.date || !priests.length) return;")
end=s.index("  const next = useMemo", start)
rep_page.write_text(s[:start]+s[end:],encoding='utf-8')
rep(rep_page,"      const daFeClean = cleanTitle(record.daFe);\n      const finalDaFe = daFeClean && upper(daFeClean) !== 'EL PÁRROCO' ? `PBRO. ${upper(daFeClean)}` : upper(daFeClean || 'EL PÁRROCO');\n      const ministroClean = cleanTitle(record.ministro);\n      const finalMinister = ministroClean ? upper(ministroClean) : '';","      const finalDaFe = upper(String(record.daFe || '').trim());\n      const finalMinister = upper(String(record.ministro || '').trim());")
rep(rep_page,"      const note = `ESTA PARTIDA DE CONFIRMACIÓN SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${upper(decree.number)} DE FECHA ${dateText}${concept?.concepto ? `, MOTIVO: ${upper(concept.concepto)}` : ''}. DA FE: ${finalDaFe}.`;","      const daFeNote = finalDaFe ? ` DA FE: ${finalDaFe}.` : '';\n      const note = `ESTA PARTIDA DE CONFIRMACIÓN SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${upper(decree.number)} DE FECHA ${dateText}${concept?.concepto ? `, MOTIVO: ${upper(concept.concepto)}` : ''}.${daFeNote}`;")

print('Parches Confirmación aplicados.')
