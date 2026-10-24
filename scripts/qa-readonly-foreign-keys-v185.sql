-- SACRAMENTUM V185 — 165 foreign keys: validated, enforced and orphan-free.
-- Complete live check over public FK relationships. No business data is returned.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '60000ms';
DO $verify$
DECLARE
 fk record;
 predicate_nonnull text;
 predicate_parent text;
 orphan_found boolean;
 checked integer:=0;
 disabled integer;
BEGIN
 SELECT count(*)::int INTO disabled
 FROM pg_trigger t JOIN pg_constraint c ON c.oid=t.tgconstraint
 WHERE c.contype='f' AND c.connamespace='public'::regnamespace
 AND t.tgenabled NOT IN ('O','A');
 IF disabled<>0 THEN RAISE EXCEPTION 'V185 disabled foreign-key triggers: %',disabled; END IF;
 FOR fk IN
  SELECT c.oid,c.conname,c.conrelid,c.confrelid,c.conkey,c.confkey,
         c.convalidated,c.confmatchtype
  FROM pg_constraint c
  WHERE c.contype='f' AND c.connamespace='public'::regnamespace
  ORDER BY c.oid
 LOOP
  IF NOT fk.convalidated THEN
   RAISE EXCEPTION 'V185 not validated foreign key %',fk.conname;
  END IF;
  IF fk.confmatchtype<>'s' THEN
   RAISE EXCEPTION 'V185 unsupported foreign key match type % on %',fk.confmatchtype,fk.conname;
  END IF;
  SELECT
   string_agg(format('c.%I IS NOT NULL',a.attname),' AND ' ORDER BY k.ord),
   string_agg(format('p.%I = c.%I',b.attname,a.attname),' AND ' ORDER BY k.ord)
  INTO predicate_nonnull,predicate_parent
  FROM unnest(fk.conkey,fk.confkey) WITH ORDINALITY AS k(child_attno,parent_attno,ord)
  JOIN pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=k.child_attno
  JOIN pg_attribute b ON b.attrelid=fk.confrelid AND b.attnum=k.parent_attno;
  IF predicate_nonnull IS NULL OR predicate_parent IS NULL THEN
   RAISE EXCEPTION 'V185 cannot inspect key %',fk.conname;
  END IF;
  EXECUTE format(
   'SELECT EXISTS(SELECT 1 FROM %s c WHERE %s AND NOT EXISTS(SELECT 1 FROM %s p WHERE %s))',
   fk.conrelid::regclass,predicate_nonnull,fk.confrelid::regclass,predicate_parent
  ) INTO orphan_found;
  IF orphan_found THEN
   RAISE EXCEPTION 'V185 orphan in foreign key %',fk.conname;
  END IF;
  checked:=checked+1;
 END LOOP;
 IF checked<160 THEN RAISE EXCEPTION 'V185 incomplete foreign key inventory %',checked; END IF;
 PERFORM set_config('qa185.counts',jsonb_build_object(
  'checked_foreign_keys',checked,'orphaned_constraints',0,
  'not_valid_constraints',0,'disabled_fk_triggers',0
 )::text,true);
END $verify$;
SELECT current_setting('qa185.counts')::jsonb AS qa_catalog_counts;
ROLLBACK;
