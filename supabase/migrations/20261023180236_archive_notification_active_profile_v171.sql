-- SACRAMENTUM V171 · Revocar archivado de aviso matrimonial a perfil suspendido.
-- No toca documentos ni datos históricos; conserva firma, grants y seguridad de la RPC.
-- Pre-QA: un perfil ficticio status=SUSPENDED/is_active=true pudo archivar un aviso ficticio.
DO $v171$
DECLARE
 v_src text;
 v_old text := $old$where up.auth_user_id=auth.uid() and lower(coalesce(up.role,''))='parish' and coalesce(up.is_active,true)=true$old$;
 v_new text := $new$where up.auth_user_id=auth.uid() and lower(coalesce(up.role,''))='parish'
    and coalesce(up.is_active,true)=true and upper(coalesce(up.status,'ACTIVE'))='ACTIVE'$new$;
BEGIN
 SELECT replace(pg_get_functiondef('public.archive_matrimonial_notification_recipient(uuid)'::regprocedure),
  E'\r\n',E'\n') INTO v_src;
 IF position(v_old IN v_src)=0 THEN
  RAISE EXCEPTION 'V171 archivador incompatible con contrato auditado; abortar migración';
 END IF;
 IF position('upper(coalesce(up.status,' IN v_src)>0 THEN
  RAISE EXCEPTION 'V171 archivador ya contiene validación de status; migración no aplicable';
 END IF;
 EXECUTE replace(v_src,v_old,v_new);
END $v171$;
