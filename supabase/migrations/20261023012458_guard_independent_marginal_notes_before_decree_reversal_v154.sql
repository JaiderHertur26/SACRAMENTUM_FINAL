-- V154 · Preserve independent active marginal notes on a supplemental record.
-- A later note requires manual reconciliation before reversing its source decree.
-- The note writer locks the record FOR SHARE, and reversal checks notes AFTER
-- locking supplemental record FOR UPDATE (prevents a check/insert race).
-- Alter only definitions, preserve owner/signatures/GRANTs/search_path.
DO $v154$
DECLARE
 v_signature text; v_ddl text; v_old text; v_new text; v_count integer;
 v_correction_guard text := $guard$
  if exists (
    select 1 from public.marginal_notes mn
    where mn.parish_id=v_decree.parish_id
      and mn.sacrament_id=v_decree.replacement_record_id
      and lower(coalesce(mn.sacrament_type,''))=lower(coalesce(v_decree.sacrament_type,''))
      and mn.decree_id is distinct from v_decree.id
      and lower(coalesce(mn.status,'active')) in ('active','vigente')
  ) then
    raise exception 'La supletoria tiene notas marginales independientes posteriores: conciliación obligatoria'
      using errcode='23514';
  end if;
$guard$;
 v_reposition_guard text := $guard$
  if exists (
    select 1 from public.marginal_notes mn
    where mn.parish_id=v_decree.parish_id
      and mn.sacrament_id=v_replacement
      and lower(coalesce(mn.sacrament_type,''))=lower(coalesce(v_sacrament,''))
      and mn.decree_id is distinct from v_decree.id
      and lower(coalesce(mn.status,'active')) in ('active','vigente')
  ) then
    raise exception 'La supletoria tiene notas marginales independientes posteriores: conciliación obligatoria'
      using errcode='23514';
  end if;
$guard$;
BEGIN
 -- Row SHARE locks are held through insertion of an independent note.
 v_signature:='public.create_manual_marginal_note(uuid,text,uuid,text,date,text,boolean,text,uuid,jsonb,jsonb)';
 SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_ddl;
 IF v_ddl IS NULL THEN RAISE EXCEPTION 'V154 missing manual note function'; END IF;
 v_old:='if not exists(select 1 from public.baptisms where id=p_sacrament_id and parish_id=p_parish_id) then raise exception ''Bautismo no encontrado''; end if;';
 v_new:='perform 1 from public.baptisms where id=p_sacrament_id and parish_id=p_parish_id and lower(coalesce(status,'''') ) not in (''reversed'',''revertida'') for share; if not found then raise exception ''Bautismo inexistente o ya revertido para nuevas notas''; end if;';
 IF (length(v_ddl)-length(replace(v_ddl,v_old,'')))/length(v_old)<>1 THEN
   RAISE EXCEPTION 'V154 Baptism note guard changed'; END IF;
 v_ddl:=replace(v_ddl,v_old,v_new);
 v_old:='if not exists(select 1 from public.confirmations where id=p_sacrament_id and parish_id=p_parish_id) then raise exception ''Confirmación no encontrada''; end if;';
 v_new:='perform 1 from public.confirmations where id=p_sacrament_id and parish_id=p_parish_id and lower(coalesce(status,'''') ) not in (''reversed'',''revertida'') for share; if not found then raise exception ''Confirmación inexistente o ya revertida para nuevas notas''; end if;';
 IF (length(v_ddl)-length(replace(v_ddl,v_old,'')))/length(v_old)<>1 THEN
   RAISE EXCEPTION 'V154 Confirmation note guard changed'; END IF;
 EXECUTE v_ddl;
 -- The correction reversal has locked original and supplemental rows FOR UPDATE
 -- by the time this guard executes.
 v_signature:='public.reverse_correction_decree(uuid)';
 SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_ddl;
 IF v_ddl IS NULL THEN RAISE EXCEPTION 'V154 missing correction reversal';END IF;
 v_old:='  end if;'||chr(10)||chr(10)||'  if v_decree.sacrament_type='||chr(39)||'bautismo'||chr(39)||' then';
 v_new:='  end if;'||chr(10)||v_correction_guard||chr(10)||'  if v_decree.sacrament_type='||chr(39)||'bautismo'||chr(39)||' then';
 IF (length(v_ddl)-length(replace(v_ddl,v_old,'')))/length(v_old)<>1 THEN
   RAISE EXCEPTION 'V154 correction lock/restore anchor changed';END IF;
 EXECUTE replace(v_ddl,v_old,v_new);
 -- Replacement reversal has locked supplemental row FOR UPDATE by this point.
 v_signature:='public.reverse_replacement_decree(uuid)';
 SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_ddl;
 IF v_ddl IS NULL THEN RAISE EXCEPTION 'V154 missing replacement reversal';END IF;
 v_old:='  end if;'||chr(10)||chr(10)||'  if v_sacrament in (''confirmacion'',''confirmation'',''confirmaciones'') then'||chr(10)||'    update public.confirmations';
 v_new:='  end if;'||chr(10)||v_reposition_guard||chr(10)||'  if v_sacrament in (''confirmacion'',''confirmation'',''confirmaciones'') then'||chr(10)||'    update public.confirmations';
 IF (length(v_ddl)-length(replace(v_ddl,v_old,'')))/length(v_old)<>1 THEN
   RAISE EXCEPTION 'V154 replacement lock/update anchor changed';END IF;
 EXECUTE replace(v_ddl,v_old,v_new);
END $v154$;
