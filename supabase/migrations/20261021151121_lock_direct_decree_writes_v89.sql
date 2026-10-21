-- SACRAMENTUM V89 · Bloqueo de escrituras directas de decretos.
-- Toda emisión/reversión operativa debe pasar por RPC institucionales auditadas.
-- Las funciones SECURITY DEFINER existentes no dependen de este GRANT.
BEGIN;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.decretos FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.decretos TO authenticated;

-- La lectura sigue aislada por la política RLS decretos_select_scope.
-- No se añaden ni cambian partidas y no se modifican expedientes existentes.

COMMIT;
