-- V101: no crear lotes legacy sin parroquia desde Administrador General.
-- V100 cerró can_manage_legacy_import pero create_legacy_import_batch contenía
-- una excepción antigua, reproducida como admin_general con REPORTES_FRX.
-- Sustitución acotada y comprobada: mantiene creación diocesana autorizada.
DO $fix$
DECLARE
 v_src text;
 v_old text := E'if v_role=''admin_general'' then\n      null;\n    elsif v_role=''diocese''';
 v_new text := 'if v_role=''diocese''';
BEGIN
 SELECT pg_get_functiondef('public.create_legacy_import_batch(text,text,text,text,uuid,uuid,jsonb)'::regprocedure)
 INTO v_src;
 IF length(v_src)-length(replace(v_src,v_old,'')) <> length(v_old) THEN
   RAISE EXCEPTION 'Versión inesperada de create_legacy_import_batch; cancelando parche V101';
 END IF;
 EXECUTE replace(v_src,v_old,v_new);
END$fix$;