BEGIN;
-- V290: función de comprobación limitada. Las políticas de storage.objects
-- no pueden leer directamente las tablas privadas desde rol authenticated.
CREATE FUNCTION public.can_access_sacramental_evidence_v290(p_name text,p_write boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT auth.uid() IS NOT NULL AND p_name IS NOT NULL
 AND EXISTS(
  SELECT 1
  FROM public.sacramental_external_returns_v277 e
  JOIN public.matrimonial_notifications n ON n.id=e.notification_id
  JOIN public.user_profiles up ON up.parish_id=n.sender_parish_id
  JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
  WHERE up.auth_user_id=auth.uid() AND up.role='parish'
  AND up.is_active AND upper(coalesce(up.status,''))='ACTIVE'
  AND p.is_operational IS TRUE
  AND (p_write IS DISTINCT FROM TRUE OR e.status<>'returned')
  AND split_part(p_name,'/',1)=n.sender_parish_id::text
  AND split_part(p_name,'/',2)=n.id::text
  AND split_part(p_name,'/',3)=e.id::text
  AND split_part(p_name,'/',5)=''
  AND length(split_part(p_name,'/',4)) BETWEEN 40 AND 60
  AND (right(lower(p_name),4) IN ('.pdf','.png','.jpg')
    OR right(lower(p_name),5)='.jpeg')
 );
$fn$;
REVOKE ALL ON FUNCTION public.can_access_sacramental_evidence_v290(text,boolean)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_sacramental_evidence_v290(text,boolean)
 TO authenticated;
DROP POLICY IF EXISTS sacramental_evidence_sender_insert_v288 ON storage.objects;
CREATE POLICY sacramental_evidence_sender_insert_v288 ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (
 bucket_id='sacramental-return-evidence'
 AND public.can_access_sacramental_evidence_v290(name,true)
);
DROP POLICY IF EXISTS sacramental_evidence_sender_read_v288 ON storage.objects;
CREATE POLICY sacramental_evidence_sender_read_v288 ON storage.objects
 FOR SELECT TO authenticated USING (
 bucket_id='sacramental-return-evidence'
 AND public.can_access_sacramental_evidence_v290(name,false)
);
COMMIT;
