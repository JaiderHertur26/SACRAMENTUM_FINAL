-- V122: Bloquear operaciones destructivas y de esquema para clientes públicos.
-- NO se ejecuta TRUNCATE; sólo REVOKE de privilegios.
-- Un DELETE legítimo sigue regido por grants y RLS; esta migración no toca esos permisos.
DO $guard$
DECLARE v record;
BEGIN
  FOR v IN SELECT n.nspname,c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE %I.%I FROM authenticated, anon, PUBLIC',
      v.nspname,v.relname
    );
  END LOOP;
END
$guard$;

-- Evitar reinstalar esas capacidades en tablas futuras creadas por postgres.
-- Los defaults de supabase_admin requieren intervención separada de su propietario.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM authenticated, anon, PUBLIC;
