-- V258 disposable restoration of former wide permission surface, plus representative
-- SECURITY DEFINER procedures; NEVER apply to Supabase.
ALTER TABLE public.parish_parameters ENABLE ROW LEVEL SECURITY;
CREATE POLICY parish_parameters_select_scoped ON public.parish_parameters
  FOR SELECT TO authenticated USING (parish_id=public.current_app_parish_id());
CREATE POLICY parish_parameters_insert_owner ON public.parish_parameters
  FOR INSERT TO authenticated WITH CHECK (parish_id=public.current_app_parish_id());
CREATE POLICY parish_parameters_update_owner ON public.parish_parameters
  FOR UPDATE TO authenticated USING (parish_id=public.current_app_parish_id())
    WITH CHECK (parish_id=public.current_app_parish_id());
CREATE POLICY parish_parameters_delete_owner ON public.parish_parameters
  FOR DELETE TO authenticated USING (parish_id=public.current_app_parish_id());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.parish_parameters TO authenticated;

CREATE FUNCTION public.save_baptism_parameters(uuid,jsonb,integer,integer,integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.save_marriage_parameters(uuid,jsonb,integer,integer,integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.save_funeral_parameters(uuid,jsonb)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT '{}'::jsonb $$;

-- Simulate a real independent counter consumer: an internal boleta RPC writes
-- the same parish row as V256 but continues to work after the ACL lockdown.
CREATE FUNCTION public.create_pending_baptism(uuid,jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_counter text;
BEGIN
  UPDATE public.parish_parameters SET bautizos_params=jsonb_set(
    bautizos_params,'{numeroRegistroActual}',to_jsonb(
      lpad(((bautizos_params->>'numeroRegistroActual')::bigint+1)::text,6,'0')),true)
    WHERE parish_id=$1 RETURNING bautizos_params->>'numeroRegistroActual' INTO v_counter;
  RETURN jsonb_build_object('numeroRegistroActual',v_counter);
END $$;

CREATE FUNCTION public.create_pending_confirmation(uuid,jsonb)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.create_pending_marriage(uuid,jsonb)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.create_pending_funeral(uuid,jsonb)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.seat_baptism_records(uuid,jsonb,integer,integer,integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.seat_pending_marriage(uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.seat_funeral_record(jsonb,uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT '{}'::jsonb $$;

GRANT EXECUTE ON FUNCTION
  public.save_baptism_parameters(uuid,jsonb,integer,integer,integer),
  public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer),
  public.save_marriage_parameters(uuid,jsonb,integer,integer,integer),
  public.save_funeral_parameters(uuid,jsonb),
  public.create_pending_baptism(uuid,jsonb),
  public.create_pending_confirmation(uuid,jsonb),
  public.create_pending_marriage(uuid,jsonb),
  public.create_pending_funeral(uuid,jsonb),
  public.seat_baptism_records(uuid,jsonb,integer,integer,integer),
  public.seat_confirmation_records(uuid,jsonb,integer,integer,integer),
  public.seat_pending_marriage(uuid),
  public.seat_funeral_record(jsonb,uuid)
TO authenticated;
