-- SACRAMENTUM V240: fail-closed active institutional identity for marriage and funeral decree reversals.
-- Schema-only, no data mutation; original function bodies and privileges preserved.
-- Abort atomically if the audited legacy guards do not match exactly.
DO $v240$
DECLARE
  v_signature text;
  v_ddl text;
  v_old_active text;
  v_new_active text := 'up.is_active IS TRUE';
  v_old_status text := 'coalesce(up.status,''active'') not in (''blocked'',''disabled'',''inactive'')';
  v_new_status text := 'upper(coalesce(up.status,'''') )=''ACTIVE''';
  v_old_join text := 'from public.user_profiles up';
  v_new_join text := 'from public.user_profiles up' || chr(10)
    || '  join public.chancelleries ch on ch.id=up.chancery_id and ch.diocese_id=up.diocese_id';
  v_old_role text := 'if v_role <> ''chancery'' then';
  v_new_role text := 'if v_role IS DISTINCT FROM ''chancery'' then';
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.reverse_marriage_decree(uuid,text)',
    'public.reverse_funeral_decree(uuid,text)'
  ] LOOP
    SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_ddl;
    IF v_ddl IS NULL THEN
      RAISE EXCEPTION 'V240: function absent: %',v_signature;
    END IF;
    IF v_signature LIKE '%funeral%' THEN
      v_old_active := 'coalesce(up.is_active,true)=true';
    ELSE
      v_old_active := 'coalesce(up.is_active,true) = true';
    END IF;

    IF (length(v_ddl)-length(replace(v_ddl,v_old_active,'')))/length(v_old_active) <> 1
      OR (length(v_ddl)-length(replace(v_ddl,v_old_status,'')))/length(v_old_status) <> 1
      OR (length(v_ddl)-length(replace(v_ddl,v_old_join,'')))/length(v_old_join) <> 1
      OR (length(v_ddl)-length(replace(v_ddl,v_old_role,'')))/length(v_old_role) <> 1
    THEN
      RAISE EXCEPTION 'V240: audited identity guard drifted, no changes applied: %',v_signature;
    END IF;

    v_ddl := replace(v_ddl,v_old_active,v_new_active);
    v_ddl := replace(v_ddl,v_old_status,v_new_status);
    v_ddl := replace(v_ddl,v_old_join,v_new_join);
    v_ddl := replace(v_ddl,v_old_role,v_new_role);
    EXECUTE v_ddl;
  END LOOP;
END $v240$;

-- These functions remain SECURITY DEFINER with their prior EXECUTE grants,
-- but only an ACTIVE Chancery profile bound to the correct Chancery/diocese
-- can proceed to the existing decree and jurisdiction checks.
