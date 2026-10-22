-- V122 · Verificar privilegios efectivos de authenticated sin TRUNCATE real.
BEGIN;
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE v_rec record;v_unsafe integer:=0;v_view integer:=0;
BEGIN
 FOR v_rec IN SELECT c.oid,c.relname
 FROM pg_class c WHERE c.relnamespace='public'::regnamespace
 AND c.relkind IN ('r','p') LOOP
   IF has_table_privilege(v_rec.oid,'TRUNCATE')
    OR has_table_privilege(v_rec.oid,'REFERENCES')
    OR has_table_privilege(v_rec.oid,'TRIGGER')
    OR has_table_privilege(v_rec.oid,'MAINTAIN') THEN
    v_unsafe:=v_unsafe+1;
   END IF;
 END LOOP;
 IF v_unsafe<>0 THEN RAISE EXCEPTION 'V122 unsafe privileges remain on % tables',v_unsafe; END IF;
 SELECT count(*) INTO v_view FROM pg_class c
 WHERE c.relnamespace='public'::regnamespace AND c.relname IN
 ('baptisms','confirmations','marriages','funerals','decretos','user_profiles')
 AND has_table_privilege(c.oid,'SELECT');
 IF v_view<>6 THEN RAISE EXCEPTION 'V122 regression: normal SELECT privilege lost'; END IF;
END $qa$;
ROLLBACK;