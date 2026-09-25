-- SACRAMENTUM V23 · CIERRE DE EJECUCIÓN HEREDADA POR PUBLIC
-- 2026-09-25
-- PostgreSQL concede EXECUTE a PUBLIC por defecto sobre funciones nuevas.
-- Este cambio elimina esa herencia universal. Los grants explícitos de
-- authenticated y service_role se conservan.

begin;

revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;

notify pgrst, 'reload schema';
commit;
