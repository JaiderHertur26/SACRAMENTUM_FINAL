-- SACRAMENTUM V311 — limpieza de enlaces polimórficos confirmadamente rotos.
-- No se borran evidencias históricas, partidas, decretos, auditorías ni constancias.
-- La intervención conserva imagen completa previa de 611 filas, de acceso privado.
-- Si las cantidades cambiaron o surge una relación no prevista: ROLLBACK integral.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '100s';
LOCK TABLE public.legacy_import_ownership, public.legacy_record_links,
 public.legacy_import_rows, public.baptisms, public.confirmations IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS sacramentum_ledger.orphan_cleanup_archive_v311 (
 source_table text NOT NULL,
 source_id uuid NOT NULL,
 reason text NOT NULL,
 original_row jsonb NOT NULL,
 saved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(source_table,source_id)
);
REVOKE ALL ON sacramentum_ledger.orphan_cleanup_archive_v311 FROM PUBLIC, anon, authenticated;

DO $clean$
DECLARE bad_ownership bigint; bad_links bigint; bad_import_rows bigint;
 archived bigint; changed_ownership bigint; changed_links bigint; changed_rows bigint;
BEGIN
 SELECT count(*) INTO bad_ownership FROM public.legacy_import_ownership o
 WHERE (o.target_table='baptism' AND NOT EXISTS(SELECT 1 FROM public.baptisms b WHERE b.id=o.target_id))
    OR (o.target_table='confirmation' AND NOT EXISTS(SELECT 1 FROM public.confirmations c WHERE c.id=o.target_id));
 SELECT count(*) INTO bad_links FROM public.legacy_record_links o
 WHERE (o.target_table='baptism' AND NOT EXISTS(SELECT 1 FROM public.baptisms b WHERE b.id=o.target_id))
    OR (o.target_table='confirmation' AND NOT EXISTS(SELECT 1 FROM public.confirmations c WHERE c.id=o.target_id));
 SELECT count(*) INTO bad_import_rows FROM public.legacy_import_rows o
 WHERE o.target_table='confirmation' AND o.target_id IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.confirmations c WHERE c.id=o.target_id);

 IF bad_ownership<>219 OR bad_links<>219 OR bad_import_rows<>173 THEN
  RAISE EXCEPTION 'V311: los conteos ya no coinciden (ownership %, links %, import rows %); aborto',bad_ownership,bad_links,bad_import_rows;
 END IF;

 INSERT INTO sacramentum_ledger.orphan_cleanup_archive_v311(source_table,source_id,reason,original_row)
 SELECT 'legacy_import_ownership',o.id,'orphan_link_to_missing_baptism_or_confirmation',to_jsonb(o)
 FROM public.legacy_import_ownership o
 WHERE (o.target_table='baptism' AND NOT EXISTS(SELECT 1 FROM public.baptisms b WHERE b.id=o.target_id))
    OR (o.target_table='confirmation' AND NOT EXISTS(SELECT 1 FROM public.confirmations c WHERE c.id=o.target_id))
 UNION ALL
 SELECT 'legacy_record_links',o.id,'orphan_link_to_missing_baptism_or_confirmation',to_jsonb(o)
 FROM public.legacy_record_links o
 WHERE (o.target_table='baptism' AND NOT EXISTS(SELECT 1 FROM public.baptisms b WHERE b.id=o.target_id))
    OR (o.target_table='confirmation' AND NOT EXISTS(SELECT 1 FROM public.confirmations c WHERE c.id=o.target_id))
 UNION ALL
 SELECT 'legacy_import_rows',o.id,'import_source_retained_invalid_confirmation_target_removed',to_jsonb(o)
 FROM public.legacy_import_rows o WHERE o.target_table='confirmation' AND o.target_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.confirmations c WHERE c.id=o.target_id)
 ON CONFLICT DO NOTHING;

 SELECT count(*) INTO archived FROM sacramentum_ledger.orphan_cleanup_archive_v311;
 IF archived<>611 THEN
  RAISE EXCEPTION 'V311: backup privado incompleto (esperados 611; encontrados %)',archived;
 END IF;

 DELETE FROM public.legacy_import_ownership o
 WHERE (o.target_table='baptism' AND NOT EXISTS(SELECT 1 FROM public.baptisms b WHERE b.id=o.target_id))
    OR (o.target_table='confirmation' AND NOT EXISTS(SELECT 1 FROM public.confirmations c WHERE c.id=o.target_id));
 GET DIAGNOSTICS changed_ownership=ROW_COUNT;
 DELETE FROM public.legacy_record_links o
 WHERE (o.target_table='baptism' AND NOT EXISTS(SELECT 1 FROM public.baptisms b WHERE b.id=o.target_id))
    OR (o.target_table='confirmation' AND NOT EXISTS(SELECT 1 FROM public.confirmations c WHERE c.id=o.target_id));
 GET DIAGNOSTICS changed_links=ROW_COUNT;

 UPDATE public.legacy_import_rows o SET
   status='review',
   target_id=NULL,
   issue_codes=array_append(coalesce(o.issue_codes,ARRAY[]::text[]),'MISSING_TARGET_V311'),
   issue_details=coalesce(o.issue_details,'{}'::jsonb)||
    jsonb_build_object('cleanup_v311',jsonb_build_object(
     'previousTargetId',o.target_id,'reason','confirmation_target_missing',
     'action','source_preserved_for_manual_review'))
 WHERE o.target_table='confirmation' AND o.target_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.confirmations c WHERE c.id=o.target_id);
 GET DIAGNOSTICS changed_rows=ROW_COUNT;

 IF changed_ownership<>219 OR changed_links<>219 OR changed_rows<>173 THEN
  RAISE EXCEPTION 'V311: anomalía de concurrencia, actualizaciones %/%/%',changed_ownership,changed_links,changed_rows;
 END IF;
END $clean$;
COMMIT;

SELECT source_table,count(*) AS safeguarded_rows FROM sacramentum_ledger.orphan_cleanup_archive_v311
GROUP BY source_table ORDER BY source_table;