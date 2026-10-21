-- V98: la evidencia histórica no se corrige sobrescribiendo su origen.
-- Reproducción: chancery cambió source_kind de legacy_catalog a manual
-- y source_reference arbitraria sobre un concepto histórico (ROLLBACK).
-- Las correcciones posteriores requieren nuevo concepto, preservando el anterior.
CREATE OR REPLACE FUNCTION private.guard_legacy_concept_identity_v98()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.source_kind IS DISTINCT FROM 'manual' THEN
    -- Los registros importados sólo permiten desactivación / marca de actualización.
    IF (to_jsonb(NEW) - 'is_active' - 'updated_at')
        IS DISTINCT FROM
       (to_jsonb(OLD) - 'is_active' - 'updated_at') THEN
      RAISE EXCEPTION 'El concepto histórico está protegido: desactívelo y cree otro sin sobrescribir la fuente.'
        USING ERRCODE='42501';
    END IF;
  ELSIF NEW.source_kind IS DISTINCT FROM OLD.source_kind
     OR NEW.source_reference IS DISTINCT FROM OLD.source_reference THEN
    RAISE EXCEPTION 'No está permitido alterar la procedencia del concepto institucional.'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_legacy_concept_identity_v98 ON public.conceptos_anulacion;
CREATE TRIGGER guard_legacy_concept_identity_v98
BEFORE UPDATE ON public.conceptos_anulacion
FOR EACH ROW
EXECUTE FUNCTION private.guard_legacy_concept_identity_v98();

-- Las nuevas altas directas de Cancillería siempre proceden del catálogo
-- manual. La importación histórica institucional usa una función privilegiada
-- con origen/metadata propio; no debe fingirse mediante el Data API.
ALTER POLICY conceptos_insert_authority ON public.conceptos_anulacion
WITH CHECK (
  public.current_app_role() = 'chancery'
  AND diocese_id = public.current_effective_diocese_id()
  AND source_kind = 'manual'
  AND source_reference IS NULL
);
