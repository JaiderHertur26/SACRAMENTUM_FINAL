-- SACRAMENTUM V102: autoridad de emisión, anulación y versiones documentales.
-- Hallazgo reproducido con documentos ficticios en transacciones ROLLBACK:
-- admin_general podía emitir y anular para cualquier parroquia; también podía
-- editar/activar plantillas parroquiales ajenas. No modificar documentos reales.
--
-- Se actualizan únicamente bloques de autorización de 3 SECURITY DEFINER.
-- Si cambia una firma o el texto esperado, la migración entera aborta.
DO $v102$
DECLARE
 v_src text;
 v_start integer;
 v_end integer;
 v_old text;
 v_new text;
BEGIN
 -- Emisión: restringir a Parroquia, Diócesis o Cancillería de su ámbito.
 SELECT pg_get_functiondef(
 'public.issue_document_from_template(uuid,jsonb,uuid,text,uuid,jsonb)'::regprocedure
 ) INTO v_src;
 v_src:=replace(v_src,E'\r\n',E'\n');
 v_start:=strpos(v_src, E'  elsif v_role = ''admin_general'' then\n');
 v_end:=strpos(v_src,E'  else\n    raise exception ''Rol no autorizado para emitir documentos'';');
 IF v_start=0 OR v_end<=v_start THEN
   RAISE EXCEPTION 'V102: firma o bloque de emisión inesperado; abortando';
 END IF;
 v_new:=substring(v_src FROM 1 FOR v_start-1)||substring(v_src FROM v_end);
 EXECUTE v_new;

 -- Anulación: ninguna potestad global del Administrador General.
 SELECT pg_get_functiondef(
 'public.void_document_issuance(uuid,text)'::regprocedure
 ) INTO v_src;
 v_src:=replace(v_src,E'\r\n',E'\n');
 v_old:=E'if v_role=''admin_general'' then null;\n  elsif v_role=''parish''';
 v_new:='if v_role=''parish''';
 IF length(v_src)-length(replace(v_src,v_old,''))<>length(v_old) THEN
   RAISE EXCEPTION 'V102: bloque de anulación inesperado; abortando';
 END IF;
 EXECUTE replace(v_src,v_old,v_new);

 -- Las plantillas de sistema siguen administradas globalmente.
 -- Diócesis/Cancillería: sólo diocesanas. Parroquia: sólo parroquiales.
 SELECT pg_get_functiondef(
 'public.save_document_template(text,text,text,text,text,uuid,uuid,jsonb)'::regprocedure
 ) INTO v_src;
 v_src:=replace(v_src,E'\r\n',E'\n');
 v_old:=E'if v_role=''admin_general'' then\n    null;\n  elsif v_role in (''diocese'',''chancery'')';
 v_new:=E'if v_role=''admin_general'' then\n    if v_scope<>''system'' then raise exception ''El Administrador General sólo administra plantillas generales del sistema''; end if;\n    v_diocese:=null; v_parish:=null;\n  elsif v_role in (''diocese'',''chancery'')';
 IF length(v_src)-length(replace(v_src,v_old,''))<>length(v_old) THEN
   RAISE EXCEPTION 'V102: bloque de plantilla inesperado; abortando';
 END IF;
 EXECUTE replace(v_src,v_old,v_new);
END$v102$;
