-- V309: nomenclatura concisa de decretos de reposición en Barranquilla.
-- No modifica tipo, sacramento, jurisdicción, procedencia, efectos, partidas ni decretos.
BEGIN;
DO $v309$
DECLARE v_di uuid := '452d50bc-ff3e-448e-9b93-1e97f8d321e2';
        v_valid integer;
BEGIN
  WITH expected(codigo,sacramento,titulo) AS (
    VALUES
      ('005','bautismo','DECRETO DE REPOSICIÓN DE BAUTISMO'),
      ('006','confirmacion','DECRETO DE REPOSICIÓN DE CONFIRMACIÓN'),
      ('007','matrimonio','DECRETO DE REPOSICIÓN DE MATRIMONIO'),
      ('008','exequias','DECRETO DE REPOSICIÓN DE ACTA DE DEFUNCIÓN')
  )
  SELECT count(*) INTO v_valid FROM public.conceptos_anulacion c
  JOIN expected e ON c.codigo=e.codigo AND c.sacrament_type=e.sacramento
  WHERE c.diocese_id=v_di AND c.tipo='porReposicion'
    AND c.source_kind='manual' AND c.is_active=true
    AND c.enlibro=2 AND c.seinscribe=true AND c.gendocum=true
    AND (c.concepto LIKE 'REPOSICIÓN DE PARTIDA DE %' OR c.concepto=e.titulo);
  IF v_valid<>4 THEN
    RAISE EXCEPTION 'V309: catálogo cambió; abortando modificación para proteger conceptos';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conceptos_anulacion c
    WHERE c.diocese_id=v_di AND c.codigo='001' AND c.tipo='porRepeticion'
      AND c.sacrament_type='general' AND c.source_kind='legacy_catalog'
      AND c.concepto='ERROR DE TRANSCRIPCION O REPETICION'
  ) THEN
    RAISE EXCEPTION 'V309: concepto histórico de Repetición difiere; abortando';
  END IF;

  WITH expected(codigo,sacramento,titulo) AS (
    VALUES
      ('005','bautismo','DECRETO DE REPOSICIÓN DE BAUTISMO'),
      ('006','confirmacion','DECRETO DE REPOSICIÓN DE CONFIRMACIÓN'),
      ('007','matrimonio','DECRETO DE REPOSICIÓN DE MATRIMONIO'),
      ('008','exequias','DECRETO DE REPOSICIÓN DE ACTA DE DEFUNCIÓN')
  )
  UPDATE public.conceptos_anulacion c
  SET concepto=e.titulo, updated_at=clock_timestamp()
  FROM expected e
  WHERE c.diocese_id=v_di AND c.codigo=e.codigo
    AND c.sacrament_type=e.sacramento AND c.tipo='porReposicion'
    AND c.source_kind='manual' AND c.is_active=true
    AND c.concepto IS DISTINCT FROM e.titulo;
END
$v309$;
COMMIT;