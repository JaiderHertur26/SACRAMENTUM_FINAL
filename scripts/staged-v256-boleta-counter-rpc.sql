-- V256 / ETAPA PREPARATORIA. NO EJECUTAR EN SUPABASE QA/PRODUCCIÓN AISLADAMENTE.
-- Requires joint cutover: revoke all legacy parameter writes, migrate dependent
-- note templates, and activate the four new seating RPCs together.
-- Only one numeric boleta counter is updated per call. No sacramental coordinates.
CREATE OR REPLACE FUNCTION public.update_parish_boleta_counter_v256(
  p_parish_id uuid, p_sacrament text, p_expected text, p_new_value text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
  v_actor_id uuid;
  v_actor_diocese uuid;
  v_parent_diocese uuid;
  v_row public.parish_parameters%rowtype;
  v_column text;
  v_current jsonb;
  v_old text;
  v_old_num bigint;
  v_new_num bigint;
  v_min_num bigint := 0;
  v_width integer;
  v_normalized text;
BEGIN
  IF auth.uid() IS NULL OR p_parish_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere sesión y parroquia.' USING ERRCODE='42501';
  END IF;
  IF public.current_app_role() IS DISTINCT FROM 'parish'
     OR public.current_app_parish_id() IS DISTINCT FROM p_parish_id THEN
    RAISE EXCEPTION 'Solo la parroquia titular puede registrar boletas.' USING ERRCODE='42501';
  END IF;
  SELECT up.id, up.diocese_id INTO STRICT v_actor_id,v_actor_diocese
    FROM public.user_profiles up
    WHERE up.auth_user_id=auth.uid()
      AND up.role='parish' AND up.parish_id=p_parish_id
      AND up.is_active IS TRUE AND upper(coalesce(up.status,''))='ACTIVE';
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Perfil parroquial activo obligatorio.' USING ERRCODE='42501';
  END IF;
  SELECT p.diocese_id INTO v_parent_diocese
    FROM public.parishes p WHERE p.id=p_parish_id;
  IF v_parent_diocese IS NULL OR v_actor_diocese IS DISTINCT FROM v_parent_diocese THEN
    RAISE EXCEPTION 'La parroquia no corresponde a la jurisdicción.' USING ERRCODE='42501';
  END IF;
  v_column := CASE p_sacrament
    WHEN 'bautismo' THEN 'bautizos_params'
    WHEN 'confirmacion' THEN 'confirmaciones_params'
    WHEN 'matrimonio' THEN 'matrimonios_params'
    WHEN 'exequias' THEN 'exequias_params'
    ELSE NULL END;
  IF v_column IS NULL THEN
    RAISE EXCEPTION 'Sacramento inválido.' USING ERRCODE='22023';
  END IF;
  IF p_expected IS NULL OR p_expected !~ '^[0-9]{1,12}$'
     OR p_new_value IS NULL OR p_new_value !~ '^[0-9]{1,12}$' THEN
    RAISE EXCEPTION 'Contador numérico inválido.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_row FROM public.parish_parameters
    WHERE parish_id=p_parish_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parámetros institucionales ausentes; deben verificarse antes de registrar.' USING ERRCODE='P0002';
  END IF;
  v_current := CASE v_column
    WHEN 'bautizos_params' THEN v_row.bautizos_params
    WHEN 'confirmaciones_params' THEN v_row.confirmaciones_params
    WHEN 'matrimonios_params' THEN v_row.matrimonios_params
    WHEN 'exequias_params' THEN v_row.exequias_params END;
  IF v_current IS NULL OR jsonb_typeof(v_current)<>'object' THEN
    RAISE EXCEPTION 'Memoria documental incompleta.' USING ERRCODE='22023';
  END IF;
  v_old := v_current->>'numeroRegistroActual';
  IF v_old IS NULL OR v_old !~ '^[0-9]{1,12}$' THEN
    RAISE EXCEPTION 'Contador de origen inválido: exige conciliación.' USING ERRCODE='22023';
  END IF;
  IF v_old::bigint <> p_expected::bigint THEN
    RAISE EXCEPTION 'El contador fue modificado por otra sesión; vuelva a consultar.' USING ERRCODE='40001';
  END IF;
  v_old_num := v_old::bigint;
  v_new_num := p_new_value::bigint;
  IF v_new_num<=v_old_num THEN
    RAISE EXCEPTION 'Solo se autoriza avanzar el contador de boletas.' USING ERRCODE='22023';
  END IF;
  -- Never allow a counter lower than existing pending/seated evidence.
  IF p_sacrament='bautismo' THEN
    SELECT greatest(
      coalesce((SELECT max(b.numero_registro::bigint) FROM public.baptisms b
        WHERE b.parish_id=p_parish_id AND b.numero_registro ~ '^[0-9]{1,12}$'),0),
      coalesce((SELECT max((pb.raw_data->>'numeroRegistro')::bigint) FROM public.pending_baptisms pb
        WHERE pb.parish_id=p_parish_id AND coalesce(pb.raw_data->>'numeroRegistro','') ~ '^[0-9]{1,12}$'),0),
      coalesce((SELECT max((pb.raw_data->>'numero_registro')::bigint) FROM public.pending_baptisms pb
        WHERE pb.parish_id=p_parish_id AND coalesce(pb.raw_data->>'numero_registro','') ~ '^[0-9]{1,12}$'),0)
    ) INTO v_min_num;
  ELSIF p_sacrament='confirmacion' THEN
    SELECT greatest(
      coalesce((SELECT max(c.numero_registro::bigint) FROM public.confirmations c
        WHERE c.parish_id=p_parish_id AND c.numero_registro ~ '^[0-9]{1,12}$'),0),
      coalesce((SELECT max((pc.raw_data->>'numeroRegistro')::bigint) FROM public.pending_confirmations pc
        WHERE pc.parish_id=p_parish_id AND coalesce(pc.raw_data->>'numeroRegistro','') ~ '^[0-9]{1,12}$'),0),
      coalesce((SELECT max((pc.raw_data->>'numero_registro')::bigint) FROM public.pending_confirmations pc
        WHERE pc.parish_id=p_parish_id AND coalesce(pc.raw_data->>'numero_registro','') ~ '^[0-9]{1,12}$'),0)
    ) INTO v_min_num;
  ELSIF p_sacrament='matrimonio' THEN
    SELECT greatest(
      coalesce((SELECT max((m.raw_data->>'numeroRegistro')::bigint) FROM public.marriages m
        WHERE m.parish_id=p_parish_id AND coalesce(m.raw_data->>'numeroRegistro','') ~ '^[0-9]{1,12}$'),0),
      coalesce((SELECT max((pm.raw_data->>'numeroRegistro')::bigint) FROM public.pending_marriages pm
        WHERE pm.parish_id=p_parish_id AND coalesce(pm.raw_data->>'numeroRegistro','') ~ '^[0-9]{1,12}$'),0)
    ) INTO v_min_num;
  ELSE
    SELECT greatest(
      coalesce((SELECT max(f.numero_registro::bigint) FROM public.funerals f
        WHERE f.parish_id=p_parish_id AND f.numero_registro ~ '^[0-9]{1,12}$'),0),
      coalesce((SELECT max(pf.numero_registro::bigint) FROM public.pending_funerals pf
        WHERE pf.parish_id=p_parish_id AND pf.numero_registro ~ '^[0-9]{1,12}$'),0)
    ) INTO v_min_num;
  END IF;
  IF v_new_num < v_min_num THEN
    RAISE EXCEPTION 'El contador no puede quedar por debajo de una boleta existente.' USING ERRCODE='23514';
  END IF;
  v_width:=greatest(length(v_old),length(p_new_value));
  v_normalized:=lpad(v_new_num::text,v_width,'0');
  -- Only write the targeted JSON column. Updating all four columns would
  -- fire unrelated UPDATE OF triggers and create avoidable contention.
  IF v_column='bautizos_params' THEN
    UPDATE public.parish_parameters
      SET bautizos_params=jsonb_set(v_current,'{numeroRegistroActual}',to_jsonb(v_normalized),true),
          updated_at=now() WHERE id=v_row.id;
  ELSIF v_column='confirmaciones_params' THEN
    UPDATE public.parish_parameters
      SET confirmaciones_params=jsonb_set(v_current,'{numeroRegistroActual}',to_jsonb(v_normalized),true),
          updated_at=now() WHERE id=v_row.id;
  ELSIF v_column='matrimonios_params' THEN
    UPDATE public.parish_parameters
      SET matrimonios_params=jsonb_set(v_current,'{numeroRegistroActual}',to_jsonb(v_normalized),true),
          updated_at=now() WHERE id=v_row.id;
  ELSE
    UPDATE public.parish_parameters
      SET exequias_params=jsonb_set(v_current,'{numeroRegistroActual}',to_jsonb(v_normalized),true),
          updated_at=now() WHERE id=v_row.id;
  END IF;
  INSERT INTO public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,
    action,before_data,after_data,metadata
  ) VALUES (
    v_actor_id,p_parish_id,v_parent_diocese,'parish_parameters',v_row.id,
    'boleta_counter_adjusted_v256',
    jsonb_build_object('sacrament',p_sacrament,'numeroRegistroActual',v_old),
    jsonb_build_object('sacrament',p_sacrament,'numeroRegistroActual',v_normalized),
    jsonb_build_object('source','authorized_counter_only','actor_auth_id',auth.uid(),
      'does_not_allocate_book_coordinates',true)
  );
  RETURN jsonb_build_object('numeroRegistroActual',v_normalized);
END;
$body$;
REVOKE ALL ON FUNCTION public.update_parish_boleta_counter_v256(uuid,text,text,text) FROM PUBLIC, anon;
-- IMPORTANT: next GRANT is only safe in the integrated migration which also
-- REVOKES broad direct table writes and legacy save_* RPCs for authenticated.
GRANT EXECUTE ON FUNCTION public.update_parish_boleta_counter_v256(uuid,text,text,text) TO authenticated;
