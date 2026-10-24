-- V192 · Unicidad de Canciller ACTIVO, sin bloquear sustitución por suspensión.
-- Migración ya aplicada en Supabase como 20261024205559.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='25000ms';
CREATE UNIQUE INDEX uq_active_chancery_user_active_state_v192
 ON public.user_profiles (chancery_id)
 WHERE chancery_id IS NOT NULL
 AND lower(coalesce(role,''))='chancery'
 AND is_active IS TRUE
 AND upper(coalesce(status,''))='ACTIVE';
DROP INDEX public.uq_active_chancery_user;
ALTER INDEX public.uq_active_chancery_user_active_state_v192 RENAME TO uq_active_chancery_user;
