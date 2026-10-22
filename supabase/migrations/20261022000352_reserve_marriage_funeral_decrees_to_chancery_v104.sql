-- SACRAMENTUM V104 · Reservar los decretos de Matrimonios/Exequias a Cancillería.
-- Auditoría pre-parche: cuatro roles x siete RPC; admin_general y diocese
-- superaban las comprobaciones de competencia iniciales. Se invocaron sólo
-- IDs inexistentes/argumentos inválidos, sin modificación de partidas reales.
-- Modificación fail-closed de las 7 SECURITY DEFINER, sin modificar datos.
DO $migration$
DECLARE
  v_signatures text[] := ARRAY[
    'public.apply_funeral_correction(uuid,date,text,jsonb,text)',
    'public.apply_marriage_correction(uuid,date,text,jsonb,text)',
    'public.apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[])',
    'public.create_funeral_reposition_by_decree(uuid,date,text,jsonb,jsonb,text)',
    'public.create_marriage_reposition_by_decree(uuid,date,text,jsonb,jsonb,text)',
    'public.reverse_funeral_decree(uuid,text)',
    'public.reverse_marriage_decree(uuid,text)'
  ];
  v_signature text;
  v_source text;
  v_old_guard text := 'if v_role not in (''chancery'',''diocese'',''admin_general'') then';
  v_new_guard text := 'if v_role <> ''chancery'' then';
  v_count int;
BEGIN
  FOREACH v_signature IN ARRAY v_signatures LOOP
    SELECT pg_get_functiondef(v_signature::regprocedure) INTO v_source;
    v_source := replace(v_source, E'\r\n', E'\n');

    v_count := (length(v_source)-length(replace(v_source,v_old_guard,'')))/length(v_old_guard);
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'V104: guarda de autorización no coincide (%), cancelando todo',v_signature;
    END IF;

    IF strpos(v_source,'auth.uid()')=0
       OR strpos(v_source,'v_user_diocese')=0
       OR strpos(v_source,'v_role')=0
    THEN
      RAISE EXCEPTION 'V104: faltan comprobaciones de ámbito en %',v_signature;
    END IF;

    -- Impedir cualquier decreto a administradores generales/diocesanos.
    v_source := replace(v_source,v_old_guard,v_new_guard);
    -- Eludir menos condiciones en el código: suprimimos el antiguo bypass
    -- de jurisdicción de admin_general, que ahora resulta inaccesible.
    v_source := regexp_replace(
      v_source,
      'v_role[[:space:]]*<>[[:space:]]*''admin_general''[[:space:]]+and[[:space:]]+',
      '',
      'g'
    );

    v_source := replace(v_source,
      'Sólo Cancillería, Diócesis o Administración General pueden',
      'Sólo Cancillería puede');

    IF v_source !~ 'if v_role <> ''chancery'' then'
       OR v_source ~ '''admin_general'''
    THEN
      RAISE EXCEPTION 'V104: persiste un rol global en %',v_signature;
    END IF;

    EXECUTE v_source;
  END LOOP;
END$migration$;
