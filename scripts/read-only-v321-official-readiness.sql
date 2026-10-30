-- SACRAMENTUM V321 · Read-only institutional go-live preflight.
-- No data deletion, no grants, no official book initialization.
WITH facts AS (
 SELECT
   (SELECT count(*) FROM public.parishes WHERE is_operational IS TRUE) AS operational_parishes,
   (SELECT count(DISTINCT parish_id) FROM public.user_profiles WHERE role='parish'
     AND is_active IS TRUE AND upper(status)='ACTIVE' AND auth_user_id IS NOT NULL) AS active_account_parishes,
   (SELECT count(*) FROM public.baptisms) AS baptisms,
   (SELECT count(*) FROM public.confirmations) AS confirmations,
   (SELECT count(*) FROM public.marriages) AS marriages,
   (SELECT count(*) FROM public.funerals) AS funerals,
   (SELECT count(*) FROM public.decretos) AS decrees,
   (SELECT count(*) FROM sacramentum_ledger.book_memories) AS official_book_memories,
   (SELECT count(*) FROM sacramentum_ledger.active_seats) AS official_seats,
   (SELECT count(*) FROM sacramentum_ledger.master_review_v273) AS master_reviews,
   (to_regclass('sacramentum_ledger.purge_receipts_v268') IS NOT NULL) AS has_purge_receipt_table,
   (to_regclass('sacramentum_ledger.go_live_receipt_v267') IS NOT NULL) AS has_go_live_receipt_table,
   (SELECT count(*) FROM public.user_profiles up LEFT JOIN auth.users au
     ON au.id=up.auth_user_id WHERE up.is_active IS TRUE AND upper(up.status)='ACTIVE'
       AND (up.auth_user_id IS NULL OR au.id IS NULL)) AS active_profiles_without_auth,
   (SELECT count(*) FROM (SELECT auth_user_id FROM public.user_profiles
     WHERE is_active IS TRUE AND upper(status)='ACTIVE' AND auth_user_id IS NOT NULL
     GROUP BY auth_user_id HAVING count(*)>1) duplicate_profiles) AS duplicate_auth_identities,
   (SELECT count(*) FROM public.user_profiles up LEFT JOIN public.parishes p ON p.id=up.parish_id
     WHERE up.role='parish' AND up.is_active IS TRUE AND upper(up.status)='ACTIVE'
       AND (p.id IS NULL OR p.is_operational IS DISTINCT FROM TRUE
       OR up.diocese_id IS DISTINCT FROM p.diocese_id)) AS invalid_parish_scopes
)
SELECT jsonb_build_object(
 'status',CASE WHEN baptisms+confirmations+marriages+funerals+decrees>0
  OR NOT has_purge_receipt_table OR NOT has_go_live_receipt_table
  OR master_reviews<>26 OR active_profiles_without_auth>0
  OR duplicate_auth_identities>0 OR invalid_parish_scopes>0
  THEN 'BLOQUEADO_HASTA_CIERRE_INSTITUCIONAL' ELSE 'REQUIERE_VERIFICACION_FIRMADA' END,
 'evidence',jsonb_build_object(
  'operational_parishes',operational_parishes,
  'operational_parishes_with_active_account',active_account_parishes,
  'historical_test_records',baptisms+confirmations+marriages+funerals,
  'test_decrees',decrees,'official_book_memories',official_book_memories,
  'official_seats',official_seats,'master_review_rows',master_reviews,
  'purge_receipt_table_exists',has_purge_receipt_table,
  'go_live_receipt_table_exists',has_go_live_receipt_table,
  'active_profiles_without_auth',active_profiles_without_auth,
  'duplicate_auth_identities',duplicate_auth_identities,
  'invalid_parish_scopes',invalid_parish_scopes),
 'no_mutation',true,
 'next_action','Exigir respaldo y restauración V268, doble revisión institucional V273 y apertura V267; no ejecutar limpieza unilateral'
) AS v321_preflight
FROM facts;
