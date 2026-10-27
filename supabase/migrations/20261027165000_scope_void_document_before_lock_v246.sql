-- SACRAMENTUM FINAL V246 — refuse document enumeration between institutions.
-- Only modify the audited SECURITY DEFINER routine. No data changes.
DO $v246$
DECLARE
  v_source text;
  v_old text :=
    '  select * into v_row from public.document_issuances where id=p_issuance_id for update;' || chr(10) ||
    '  if v_row.id is null then raise exception ''Documento no encontrado''; end if;' || chr(10) || chr(10) ||
    '  if v_role=''parish'' and v_row.parish_id is not distinct from v_parish then null;' || chr(10) ||
    '  elsif v_role in (''diocese'',''chancery'') and v_row.diocese_id is not distinct from v_diocese then null;' || chr(10) ||
    '  else raise exception ''Documento fuera de su jurisdicción''; end if;';
  v_new text :=
    '  select * into v_row from public.document_issuances' || chr(10) ||
    '  where id=p_issuance_id' || chr(10) ||
    '    and (' || chr(10) ||
    '      (v_role=''parish'' and v_parish is not null and parish_id=v_parish)' || chr(10) ||
    '      or (v_role in (''diocese'',''chancery'') and v_diocese is not null and diocese_id=v_diocese)' || chr(10) ||
    '    )' || chr(10) ||
    '  for update;' || chr(10) ||
    '  if v_row.id is null then raise exception ''Documento no encontrado''; end if;';
  v_hits integer;
BEGIN
  SELECT pg_get_functiondef(to_regprocedure('public.void_document_issuance(uuid,text)')) INTO v_source;
  IF v_source IS NULL THEN RAISE EXCEPTION 'V246 missing audited document void RPC'; END IF;
  v_hits := (length(v_source)-length(replace(v_source,v_old,'')))/length(v_old);
  IF v_hits <> 1 THEN
    RAISE EXCEPTION 'V246 audited jurisdiction ordering drift, refuse rewrite (found %)',v_hits;
  END IF;
  v_source := replace(v_source,v_old,v_new);
  EXECUTE v_source;
END $v246$;

-- A foreign document, an absent document, and a document out of role scope
-- now all raise "Documento no encontrado", with no foreign-row lock taken.
-- A permitted document still follows the existing status, audit and void rules.
