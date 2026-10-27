-- V243: Chancery identity must be ACTIVE, linked and bound to the origin's diocese.
-- Safe, atomic SQL-function patch. Does not write or delete sacramental records.
DO $v243$
DECLARE
 v_ddl text;
 v_old_role text := 'if v_role <> ''chancery'' then';
 v_old_enabled text := 'coalesce(up.is_active,true)=true';
 v_new_enabled text :=
   'up.is_active IS TRUE AND upper(coalesce(up.status,'''') )=''ACTIVE'''
   || ' AND lower(coalesce(up.role,'''') )=''chancery'''
   || ' AND up.diocese_id=v_user_diocese'
   || ' AND EXISTS (SELECT 1 FROM public.chancelleries v243_ch'
   || ' WHERE v243_ch.id=up.chancery_id AND v243_ch.diocese_id=up.diocese_id)';
 v_old_tail text :=
   '      and coalesce(up.is_active,true)=true' || chr(10)
   || '    limit 1;' || chr(10)
   || '  end if;';
 v_new_tail text :=
   '      and ' || v_new_enabled || chr(10)
   || '    limit 1;' || chr(10)
   || '  end if;' || chr(10)
   || '  if v_chancery IS NULL then' || chr(10)
   || '    raise exception ''Cancillería activa y vinculada a esta diócesis requerida'''
   || ' using errcode=''42501'';' || chr(10)
   || '  end if;';
BEGIN
 SELECT pg_get_functiondef(to_regprocedure('public.materialize_legacy_decrees_v68(uuid,integer)'))
   INTO v_ddl;
 IF v_ddl IS NULL THEN RAISE EXCEPTION 'V243 RPC not found'; END IF;
 IF (length(v_ddl)-length(replace(v_ddl,v_old_role,'')))/length(v_old_role) <> 1
    OR (length(v_ddl)-length(replace(v_ddl,v_old_tail,'')))/length(v_old_tail) <> 1
 THEN
   RAISE EXCEPTION 'V243 safety failure: role or profile checks have changed';
 END IF;
 v_ddl := replace(v_ddl,v_old_role,'if v_role IS DISTINCT FROM ''chancery'' then');
 v_ddl := replace(v_ddl,v_old_tail,v_new_tail);
 EXECUTE v_ddl;
END $v243$;
