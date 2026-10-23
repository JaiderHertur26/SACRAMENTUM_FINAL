-- V155 · Prevent reversing marriage/funeral decree when a supplemental record
-- has an independent active marginal note. Serialize note insert with reversal.
-- Preserve owners, signature, privileges and existing search_path.
DO $v155$
DECLARE
 v_ddl text;
 v_old text;
 v_new text;
 v_signature text;
 v_guard text :=
 $guard$
    if exists (
      select 1 from public.marginal_notes mn
      where mn.parish_id=v_decree.parish_id
        and mn.sacrament_id=v_decree.replacement_record_id
        and lower(coalesce(mn.sacrament_type,''))=lower(coalesce(v_decree.sacrament_type,''))
        and mn.decree_id is distinct from v_decree.id
        and lower(coalesce(mn.status,'active')) in ('active','vigente')
    ) then
      raise exception 'La supletoria tiene notas marginales independientes activas: conciliación documental obligatoria'
        using errcode='23514';
    end if;
 $guard$;
BEGIN
 -- Note creation: lock own record until the note is inserted.
 v_signature:='public.create_manual_marginal_note(uuid,text,uuid,text,date,text,boolean,text,uuid,jsonb,jsonb)';
 SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_ddl;
 IF v_ddl IS NULL
   OR v_ddl NOT LIKE '%Bautismo inexistente o ya revertido para nuevas notas%'
   OR v_ddl NOT LIKE '%Confirmación inexistente o ya revertida para nuevas notas%' THEN
   RAISE EXCEPTION 'V155 requires V154 and V154b applied first';
 END IF;
 v_old:='if not exists(select 1 from public.marriages where id=p_sacrament_id and parish_id=p_parish_id) then raise exception ''Matrimonio no encontrado''; end if;';
 v_new:='perform 1 from public.marriages where id=p_sacrament_id and parish_id=p_parish_id and lower(coalesce(status,'''') ) not in (''reversed'',''revertida'') for share; if not found then raise exception ''Matrimonio inexistente o ya revertido para nuevas notas''; end if;';
 IF (length(v_ddl)-length(replace(v_ddl,v_old,'')))/length(v_old)<>1
 THEN RAISE EXCEPTION 'V155 marriage manual-note branch changed';END IF;
 v_ddl:=replace(v_ddl,v_old,v_new);
 v_old:='if not exists(select 1 from public.funerals where id=p_sacrament_id and parish_id=p_parish_id) then raise exception ''Exequias no encontradas''; end if;';
 v_new:='perform 1 from public.funerals where id=p_sacrament_id and parish_id=p_parish_id and lower(coalesce(status,'''') ) not in (''reversed'',''revertida'') for share; if not found then raise exception ''Exequias inexistentes o ya revertidas para nuevas notas''; end if;';
 IF (length(v_ddl)-length(replace(v_ddl,v_old,'')))/length(v_old)<>1
 THEN RAISE EXCEPTION 'V155 funeral manual-note branch changed';END IF;
 v_ddl:=replace(v_ddl,v_old,v_new);
 -- Critically execute both replacements together (V154 missed Confirmation).
 EXECUTE v_ddl;

 -- Marriage correction: new-partida row locked FOR UPDATE at this point.
 v_signature:='public.reverse_marriage_decree(uuid,text)';
 SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_ddl;
 IF v_ddl IS NULL THEN RAISE EXCEPTION 'V155 missing marriage reverse function';END IF;
 v_old:='    v_original_status :='||chr(10)||'      coalesce(';
 v_new:=v_guard||chr(10)||v_old;
 IF (length(v_ddl)-length(replace(v_ddl,v_old,'')))/length(v_old)<>1
 THEN RAISE EXCEPTION 'V155 unexpected marriage correction anchor';END IF;
 v_ddl:=replace(v_ddl,v_old,v_new);
 -- Marriage reposición: new-partida row locked FOR UPDATE at this point.
 v_old:='    v_replacement_note :='||chr(10)||'      ''SE REVIERTE EL DECRETO DE REPOSICIÓN ';
 v_new:=v_guard||chr(10)||v_old;
 IF (length(v_ddl)-length(replace(v_ddl,v_old,'')))/length(v_old)<>1
 THEN RAISE EXCEPTION 'V155 unexpected marriage reposition anchor';END IF;
 v_ddl:=replace(v_ddl,v_old,v_new);
 EXECUTE v_ddl;

 -- Funeral correction/reposition are similarly guarded after FOR UPDATE.
 v_signature:='public.reverse_funeral_decree(uuid,text)';
 SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_ddl;
 IF v_ddl IS NULL THEN RAISE EXCEPTION 'V155 missing funeral reverse function';END IF;
 v_old:='    v_original_status := coalesce(nullif(v_decree.payload->>''originalStatus'',''''),''seated'');';
 v_new:=v_guard||chr(10)||v_old;
 IF (length(v_ddl)-length(replace(v_ddl,v_old,'')))/length(v_old)<>1
 THEN RAISE EXCEPTION 'V155 unexpected funeral correction anchor';END IF;
 v_ddl:=replace(v_ddl,v_old,v_new);
 v_old:='      raise exception ''La partida supletoria de Exequias ya no está vigente o pertenece a otra parroquia: requiere revisión manual'''||chr(10)||'      using errcode=''23514'';'||chr(10)||'    end if;';
 v_new:=v_old||chr(10)||v_guard;
 IF (length(v_ddl)-length(replace(v_ddl,v_old,'')))/length(v_old)<>1
 THEN RAISE EXCEPTION 'V155 unexpected funeral reposition anchor';END IF;
 v_ddl:=replace(v_ddl,v_old,v_new);
 EXECUTE v_ddl;
END $v155$;
