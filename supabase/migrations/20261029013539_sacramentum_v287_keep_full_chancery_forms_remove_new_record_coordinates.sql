BEGIN;
-- V287: los formularios EXISTENTES de Cancillería conservan todos sus
-- datos; emisión sin asiento, sin numeración ni anulación anticipada.
CREATE FUNCTION public.issue_chancery_form_decree_v287(
 p_parish_id uuid, p_sacrament text, p_decree_type text,
 p_original_record_id uuid, p_concept_id uuid,
 p_decree_number text, p_decree_date date, p_target_name text,
 p_reason text, p_evidence_ref text, p_new_record jsonb, p_details jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a uuid:=auth.uid(); di uuid; pid uuid:=gen_random_uuid(); req uuid:=gen_random_uuid();
 pending_table text; raw jsonb; src jsonb; date_text text;
 issue jsonb; decree uuid; status text;
BEGIN
 SELECT up.diocese_id INTO di
 FROM public.user_profiles up WHERE up.auth_user_id=a
 AND up.role='chancery' AND up.is_active
 AND upper(coalesce(up.status,''))='ACTIVE';
 IF di IS NULL OR NOT EXISTS(SELECT 1 FROM public.parishes p
  WHERE p.id=p_parish_id AND p.diocese_id=di AND p.is_operational IS TRUE)
 THEN RAISE EXCEPTION 'V287: solo Cancillería de la diócesis competente' USING ERRCODE='42501';END IF;
 IF p_sacrament NOT IN ('bautismo','confirmacion','matrimonio','exequias')
 OR p_decree_type NOT IN ('correccion','reposicion')
 OR p_concept_id IS NULL
 OR jsonb_typeof(p_new_record) IS DISTINCT FROM 'object'
 OR coalesce(jsonb_typeof(p_details),'object')<>'object'
 OR pg_column_size(p_new_record)>131072
 OR pg_column_size(coalesce(p_details,'{}'::jsonb))>131072 THEN
  RAISE EXCEPTION 'V287: contenido institucional inválido o excesivo';
 END IF;
 IF p_decree_type='correccion' AND p_original_record_id IS NULL
 OR p_decree_type='reposicion' AND p_original_record_id IS NOT NULL THEN
  RAISE EXCEPTION 'V287: partida original incompatible con el tipo de decreto';
 END IF;
 -- Nunca se heredan las coordenadas del registro original ni las vistas previas.
 raw:=p_new_record
  - ARRAY['book','book_number','bookNumber','libro','Libro','folio','page',
   'page_number','number','entry','entry_number','numero','numeroPartida',
   'seatBook','seatFolio','seatNumber','newPartidaSummary','location','ubicacion',
   'registryCoordinates','numero_registro','numeroRegistro','status','estado'];
 date_text:=coalesce(nullif(raw->>'fechaSacramento',''),
  nullif(raw->>'fechaMatrimonio',''),
  nullif(raw->>'fecha_exequias',''),
  nullif(raw->>'celebration_date',''),
  nullif(raw->>'fechaHoraPrevista',''),
  nullif(raw->>'fechaHoraCelebracion',''));
 IF date_text IS NULL OR substring(date_text from 1 for 10)
      !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
  RAISE EXCEPTION 'V287: fecha comprobable de celebración obligatoria';
 END IF;
 BEGIN
   IF substring(date_text from 1 for 10)::date>current_date THEN
    RAISE EXCEPTION 'V287: la celebración no puede ser futura';
   END IF;
 EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
   RAISE EXCEPTION 'V287: fecha de celebración inválida';
 END;
 raw:=raw || jsonb_build_object(
  'fechaSacramento',substring(date_text from 1 for 10),
  'fechaMatrimonio',substring(date_text from 1 for 10),
  'fecha_exequias',substring(date_text from 1 for 10),
  'celebration_date',substring(date_text from 1 for 10),
  'source','new_sacrament','recordOrigin','chancery_pending_seat_v287',
  'pendingRegistryId',pid::text,'noPhysicalCoordinatesAssigned',true);
 pending_table:=CASE p_sacrament WHEN 'bautismo' THEN 'pending_baptisms'
 WHEN 'confirmacion' THEN 'pending_confirmations'
 WHEN 'matrimonio' THEN 'pending_marriages'
 ELSE 'pending_funerals' END;
 EXECUTE format('INSERT INTO public.%I(id,parish_id,status,reportado,raw_data)
   VALUES($1,$2,''pending'',false,$3)',pending_table)
 USING pid,p_parish_id,raw;
 INSERT INTO public.pending_creation_requests(
 parish_id,sacrament_type,request_id,payload_hash,response,created_by)
 VALUES(p_parish_id,p_sacrament,req,md5(pid::text||p_sacrament),
  CASE p_sacrament WHEN 'bautismo' THEN jsonb_build_object('baptism_pending_id',pid)
  ELSE jsonb_build_object('pending_id',pid) END,a);
 -- La validación de concepto y la creación de aviso se delegan al motor V280
 -- en la misma transacción. Si falla, la boleta también se revierte.
 issue:=public.issue_chancery_decree_v280(
 p_parish_id,p_sacrament,pid,p_original_record_id,p_decree_type,p_concept_id,
 p_decree_number,p_decree_date,p_target_name,p_reason,p_evidence_ref);
 decree:=(issue->>'decreeId')::uuid;
 -- Los detalles son evidencia documental, nunca coordenadas ni asiento.
 UPDATE public.decretos SET payload=payload||jsonb_build_object(
  'draftDetails',coalesce(p_details,'{}'::jsonb),
  'originalPartidaSummary',coalesce(p_details->'originalPartidaSummary','{}'::jsonb),
  'newPartidaSummary',jsonb_build_object(
    'nombres',coalesce(raw->>'nombres',raw->>'firstName',raw->>'novioNombres',''),
    'apellidos',coalesce(raw->>'apellidos',raw->>'lastName',raw->>'novioApellidos',''),
    'book',null,'page',null,'entry',null),
  'newPartidaDraft',raw,
  'decreeFormVersion','V287',
  'noPhysicalCoordinatesAssigned',true)
 WHERE id=decree AND parish_id=p_parish_id
 AND replacement_record_id IS NULL AND payload->>'seatBook' IS NULL;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'V287: no se acreditó el expediente sin asiento';
 END IF;
 RETURN issue || jsonb_build_object('status','awaiting_parish',
  'pendingId',pid,'book',null,'folio',null,'number',null);
END $fn$;
REVOKE ALL ON FUNCTION public.issue_chancery_form_decree_v287(
 uuid,text,text,uuid,uuid,text,date,text,text,text,jsonb,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.issue_chancery_form_decree_v287(
 uuid,text,text,uuid,uuid,text,date,text,text,text,jsonb,jsonb)
 TO authenticated;
-- Ninguna API antigua puede reservar la numeración de la nueva partida.
-- Estas ocho operaciones no se usan en las seis pantallas después del cambio.
DO $disable_legacy$
DECLARE p record; c integer:=0;
BEGIN
 FOR p IN SELECT q.oid,q.proname FROM pg_proc q
  JOIN pg_namespace n ON n.oid=q.pronamespace
  WHERE n.nspname='public' AND q.proname=ANY(ARRAY[
  'apply_baptism_correction','apply_confirmation_correction',
  'apply_baptism_replacement','apply_confirmation_replacement',
  'apply_marriage_correction','create_marriage_reposition_by_decree',
  'apply_funeral_correction','create_funeral_reposition_by_decree'])
 LOOP
   EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated',p.oid::regprocedure);
   IF has_function_privilege('authenticated',p.oid,'EXECUTE')
      OR has_function_privilege('anon',p.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'V287: acceso antiguo todavía disponible: %',p.proname;
   END IF;
   c:=c+1;
 END LOOP;
 IF c<>8 THEN RAISE EXCEPTION 'V287: se esperaban 8 RPC antiguas; se hallaron %',c; END IF;
END $disable_legacy$;
COMMIT;
