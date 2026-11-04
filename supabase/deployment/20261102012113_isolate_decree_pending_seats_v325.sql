-- V325: las boletas de decreto nunca se asientan por un RPC ordinario.
CREATE OR REPLACE FUNCTION sacramentum_private.is_decree_pending_v325(
 p_pending_id uuid,p_sacrament text,p_raw jsonb
) RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $f$
 SELECT
  lower(coalesce(p_raw->>'recordOrigin',p_raw->>'record_origin','')) ~ '^chancery_pending_seat_'
  OR lower(coalesce(p_raw->>'source','')) IN ('chancery_decree','decree','decree_supplement','new_decree_supplement')
  OR nullif(coalesce(p_raw->>'decreeId',p_raw->>'decree_id',p_raw->>'decretoId',p_raw->>'decreto_id'),'') IS NOT NULL
  OR EXISTS(SELECT 1 FROM public.decretos d
    WHERE d.sacrament_type=p_sacrament AND d.payload->>'pendingId'=p_pending_id::text)
  OR EXISTS(SELECT 1 FROM sacramentum_ledger.celebration_attestations_v263 e
    WHERE e.pending_id=p_pending_id AND e.sacrament=p_sacrament AND e.decree_id IS NOT NULL);
$f$;
REVOKE ALL ON FUNCTION sacramentum_private.is_decree_pending_v325(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;

DO $patch$
DECLARE r record; oid_fn oid; definition text; marker text; guard text; changed integer:=0;
BEGIN
 FOR r IN SELECT * FROM (VALUES
  ('seat_baptism_records(uuid,jsonb,integer,integer,integer)','bautismo'),
  ('seat_confirmation_records(uuid,jsonb,integer,integer,integer)','confirmacion'),
  ('seat_pending_marriage(uuid)','matrimonio'),
  ('seat_funeral_record(jsonb,uuid)','exequias')
 ) AS targets(signature,sacrament)
 LOOP
  oid_fn:=to_regprocedure('public.'||r.signature);
  IF oid_fn IS NULL THEN RAISE EXCEPTION 'V325: RPC requerido ausente: %',r.signature; END IF;
  definition:=pg_get_functiondef(oid_fn);
  IF position('sacramentum_private.is_decree_pending_v325' IN definition)>0 THEN CONTINUE; END IF;
  SELECT line INTO marker FROM regexp_split_to_table(definition,E'\n') AS line
   WHERE lower(regexp_replace(line,'[[:space:]]','','g')) LIKE 'ifcoalesce(v_pending.reportado%'
      OR lower(regexp_replace(line,'[[:space:]]','','g')) LIKE 'iflower(coalesce(v_pending.status%'
   LIMIT 1;
  IF marker IS NULL THEN RAISE EXCEPTION 'V325: no se localizó la validación del pendiente en %',r.signature; END IF;
  guard:=format(
   E'    IF sacramentum_private.is_decree_pending_v325(v_pending.id,%L,v_pending.raw_data) THEN\n      RAISE EXCEPTION ''V325: este pendiente pertenece a un decreto. Debe sentarse desde Decretos por sentar, indicando Libro, Folio y Número.'' USING ERRCODE=''23514'';\n    END IF;\n',
   r.sacrament);
  definition:=replace(definition,marker,guard||marker);
  EXECUTE definition;
  changed:=changed+1;
 END LOOP;
 IF changed NOT IN (0,4) THEN RAISE EXCEPTION 'V325: actualización incompleta de RPC ordinarios (%)',changed; END IF;
END $patch$;
