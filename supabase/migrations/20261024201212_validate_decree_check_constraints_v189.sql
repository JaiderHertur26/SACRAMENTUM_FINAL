-- SACRAMENTUM V189: cierre de restricciones jurídicas heredadas de decretos.
-- Las dos reglas NOT VALID preexistentes tenían 0 infracciones de datos.
-- No agrega columnas, no altera contenidos ni concede privilegios.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '25s';
ALTER TABLE public.decretos VALIDATE CONSTRAINT chk_decretos_sacrament_type;
ALTER TABLE public.decretos VALIDATE CONSTRAINT chk_decretos_status;
