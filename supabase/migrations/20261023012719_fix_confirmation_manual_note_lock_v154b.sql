-- V154b · Repair second branch omitted from V154 dynamic function replacement.
-- V154 already protects Baptism; this migration locks/validates Confirmation.
-- Preserve function owner, grants, default args, search_path, signatures.
DO $v154b$
DECLARE v_signature text:='public.create_manual_marginal_note(uuid,text,uuid,text,date,text,boolean,text,uuid,jsonb,jsonb)';
 v_ddl text;v_old text;v_new text;
BEGIN
 SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_ddl;
 IF v_ddl IS NULL OR v_ddl NOT LIKE '%Bautismo inexistente o ya revertido para nuevas notas%'
 THEN RAISE EXCEPTION 'V154b prerequisite Baptism lock missing';END IF;
 v_old:='if not exists(select 1 from public.confirmations where id=p_sacrament_id and parish_id=p_parish_id) then raise exception ''Confirmación no encontrada''; end if;';
 v_new:='perform 1 from public.confirmations where id=p_sacrament_id and parish_id=p_parish_id and lower(coalesce(status,'''') ) not in (''reversed'',''revertida'') for share; if not found then raise exception ''Confirmación inexistente o ya revertida para nuevas notas''; end if;';
 IF (length(v_ddl)-length(replace(v_ddl,v_old,'')))/length(v_old)<>1
 THEN RAISE EXCEPTION 'V154b unexpected Confirmation function body';END IF;
 v_ddl:=replace(v_ddl,v_old,v_new);
 EXECUTE v_ddl;
END $v154b$;
