-- SACRAMENTUM V308 - Alta explícita de conceptos de Reposición
-- Exclusivamente Arquidiócesis de Barranquilla. No altera la fuente porRepeticion.
-- 'porReposicion' NO es 'porRepeticion'. Sin original utilizable se crea asiento supletorio al sentar.
-- El procedimiento issue_chancery_decree_v280 exige enlibro=2, seinscribe=true.
-- gennota=false: una reposición sin partida utilizable no genera nota a una partida anterior.
BEGIN;
DO $v308$
DECLARE v_di uuid := '452d50bc-ff3e-448e-9b93-1e97f8d321e2';
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.dioceses WHERE id=v_di AND lower(name) LIKE '%barranquilla%') THEN
  RAISE EXCEPTION 'V308: jurisdicción Arquidiócesis de Barranquilla no encontrada';
 END IF;
 IF EXISTS(
  SELECT 1 FROM public.conceptos_anulacion c WHERE c.diocese_id=v_di
    AND c.codigo IN ('005','006','007','008')
    AND (c.tipo<>'porReposicion' OR c.sacrament_type NOT IN ('bautismo','confirmacion','matrimonio','exequias'))
 ) THEN RAISE EXCEPTION 'V308: algún código reservado ya identifica otro concepto'; END IF;
END $v308$;

WITH nuevos(codigo,concepto,sacramento) AS (
 VALUES
 ('005','REPOSICIÓN DE PARTIDA DE BAUTISMO POR INEXISTENCIA, PÉRDIDA O INUTILIZACIÓN DEL ASIENTO ORIGINAL, PREVIA COMPROBACIÓN DOCUMENTAL','bautismo'),
 ('006','REPOSICIÓN DE PARTIDA DE CONFIRMACIÓN POR INEXISTENCIA, PÉRDIDA O INUTILIZACIÓN DEL ASIENTO ORIGINAL, PREVIA COMPROBACIÓN DOCUMENTAL','confirmacion'),
 ('007','REPOSICIÓN DE PARTIDA DE MATRIMONIO POR INEXISTENCIA, PÉRDIDA O INUTILIZACIÓN DEL ASIENTO ORIGINAL, PREVIA COMPROBACIÓN DOCUMENTAL','matrimonio'),
 ('008','REPOSICIÓN DE PARTIDA DE EXEQUIAS POR INEXISTENCIA, PÉRDIDA O INUTILIZACIÓN DEL ASIENTO ORIGINAL, PREVIA COMPROBACIÓN DOCUMENTAL','exequias')
)
INSERT INTO public.conceptos_anulacion
 (diocese_id,codigo,concepto,tipo,sacrament_type,enlibro,seinscribe,gennota,gendocum,expide,source_kind,source_reference,is_active)
SELECT '452d50bc-ff3e-448e-9b93-1e97f8d321e2'::uuid,n.codigo,n.concepto,'porReposicion',n.sacramento,2,true,false,true,
 'OFICINA DE DOCUMENTOS DE CANCILLERIA','manual','V308 · alta institucional de conceptos de reposición',true
FROM nuevos n
WHERE NOT EXISTS (
 SELECT 1 FROM public.conceptos_anulacion c
 WHERE c.diocese_id='452d50bc-ff3e-448e-9b93-1e97f8d321e2'
 AND (c.codigo=n.codigo OR (c.tipo='porReposicion' AND c.sacrament_type=n.sacramento AND c.is_active=true))
);
COMMIT;