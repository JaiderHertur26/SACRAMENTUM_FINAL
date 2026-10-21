-- SACRAMENTUM V89 · Consulta mínima y jurisdiccional de auditoría de decretos.
-- registry_audit_log permanece privada: se expone SOLO la trazabilidad
-- indispensable del decreto recibido o supervisado por los cuatro roles.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_decree_trace_v89(
  p_decree_id uuid
)
RETURNS TABLE(
  action text,
  actor_name text,
  actor_role text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
  SELECT a.action::text,
    coalesce(nullif(trim(up.full_name),''),nullif(trim(up.username),''),
      case when a.actor_user_id is null then 'Sistema de importación histórica'
           else 'Usuario institucional' end)::text AS actor_name,
    coalesce(nullif(trim(up.role),''),'system')::text AS actor_role,
    a.created_at
  FROM public.decretos d
  JOIN public.registry_audit_log a
    ON a.entity_type='decree' AND a.entity_id=d.id
  LEFT JOIN public.user_profiles up ON up.auth_user_id=a.actor_user_id
  WHERE d.id=p_decree_id
    AND auth.uid() IS NOT NULL
    AND public.can_access_parish(d.parish_id)
  ORDER BY a.created_at ASC,a.id ASC
  LIMIT 40
$$;

REVOKE ALL ON FUNCTION public.get_decree_trace_v89(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_decree_trace_v89(uuid) TO authenticated;
COMMENT ON FUNCTION public.get_decree_trace_v89(uuid) IS
'Consulta mínima de trazabilidad de decretos, con aislamiento jurisdiccional. No permite acceso directo a registry_audit_log.';
COMMIT;
