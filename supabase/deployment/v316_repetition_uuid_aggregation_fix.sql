-- V316: PostgreSQL no define min(uuid) de forma estándar. Mantener equivalencia con un único registro previamente comprobado.
BEGIN;
CREATE OR REPLACE FUNCTION public.register_repetition_entry_marginal_v315(
 p_decree_id uuid,p_entry_index integer,p_method text,p_evidence text,p_observation text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 actor uuid:=auth.uid(); parish uuid; di uuid; role_name text; d public.decretos%rowtype;
 entry jsonb; entries jsonb; actions jsonb; entry_key text;
 record_uuid uuid; matched_count integer; note_uuid uuid;
 evidence text:=btrim(coalesce(p_evidence,'')); observation text:=btrim(coalesce(p_observation,''));
 note_content text; cross_reference text:=''; kept jsonb;
BEGIN
 SELECT role,diocese_id,parish_id INTO role_name,di,parish FROM public.user_profiles
 WHERE auth_user_id=actor AND is_active IS TRUE AND upper(status)='ACTIVE' LIMIT 1;
 IF actor IS NULL OR role_name<>'parish' OR di IS NULL OR parish IS NULL THEN
  RAISE EXCEPTION 'Solo la parroquia custodio puede asentar esta nota' USING ERRCODE='42501'; END IF;
 IF p_method NOT IN ('digital','physical') OR length(evidence) NOT BETWEEN 8 AND 500
 OR length(observation) NOT BETWEEN 15 AND 1500 THEN
  RAISE EXCEPTION 'Indique la forma de asiento, evidencia verificable y observación parroquial'; END IF;
 SELECT * INTO d FROM public.decretos WHERE id=p_decree_id AND diocese_id=di
 AND tipo='repeticion' AND status='active' FOR UPDATE;
 IF NOT FOUND OR d.payload->>'repetitionCaseMode'<>'duplicate_baptism_entries_v314'
 OR d.sacrament_type<>'bautismo' THEN
  RAISE EXCEPTION 'Decreto de Repetición vigente no disponible' USING ERRCODE='42501'; END IF;
 entries:=d.payload->'affectedEntries';
 IF p_entry_index IS NULL OR p_entry_index<1 OR p_entry_index>jsonb_array_length(entries) THEN
  RAISE EXCEPTION 'Partida no perteneciente al decreto'; END IF;
 entry:=entries->(p_entry_index-1);
 IF entry->>'external'='true' OR entry->>'parishId' IS DISTINCT FROM parish::text THEN
  RAISE EXCEPTION 'Solo puede actuar sobre los libros de su parroquia' USING ERRCODE='42501'; END IF;
 IF entry->>'disposition'<>'without_effect' THEN
  RAISE EXCEPTION 'Esta partida no tiene orden de nota de sin efectos registrales'; END IF;
 actions:=coalesce(d.payload->'repetitionEntryActions','{}'::jsonb);
 entry_key:='entry-'||p_entry_index;
 IF actions ? entry_key THEN RAISE EXCEPTION 'Esta partida ya tiene constancia; no se duplicará'; END IF;
 IF coalesce(d.payload->'repetitionParishActions'->parish::text->>'outcome','')='documented' THEN
  RAISE EXCEPTION 'La parroquia ya cerró su actuación'; END IF;

 SELECT count(*),(array_agg(id))[1] INTO matched_count,record_uuid FROM public.baptisms
 WHERE parish_id=parish AND btrim(coalesce(book_number,''))=entry->>'book'
 AND btrim(coalesce(folio,''))=entry->>'folio'
 AND btrim(coalesce(number,''))=entry->>'number';
 IF matched_count>1 THEN
  RAISE EXCEPTION 'Coordenadas ambiguas: hay varias partidas digitales; solicite aclaración'; END IF;
 IF nullif(coalesce(entry->>'recordId',''),'') IS NOT NULL THEN
  IF matched_count<>1 OR record_uuid::text<>entry->>'recordId' THEN
   RAISE EXCEPTION 'La partida digital ya no coincide con la vinculada al decreto'; END IF;
 END IF;
 IF p_method='digital' AND matched_count<>1 THEN
  RAISE EXCEPTION 'No existe partida digital coincidente; verifique el libro físico'; END IF;
 IF p_method='physical' AND matched_count<>0 THEN
  RAISE EXCEPTION 'Existe partida digital vinculable; debe asentar su nota digital y comprobar el libro físico'; END IF;

 SELECT x INTO kept FROM jsonb_array_elements(entries) x WHERE x->>'disposition'='retain' LIMIT 1;
 IF kept IS NOT NULL THEN
  cross_reference:=' Partida acreditativa: parroquia '||coalesce(kept->>'parishName','')
   ||', libro '||coalesce(kept->>'book','')||', folio '||coalesce(kept->>'folio','')
   ||', número '||coalesce(kept->>'number','')||'.';
 END IF;
 note_content:='POR DECRETO DE REPETICIÓN N.º '||coalesce(d.decree_number,'')
 ||' DE FECHA '||to_char(d.decree_date,'DD/MM/YYYY')
 ||', EXPEDIDO POR CANCILLERÍA, LA PRESENTE INSCRIPCIÓN QUEDA SIN EFECTOS REGISTRALES.'
 ||' EL ASIENTO ORIGINAL SE CONSERVA EN EL LIBRO Y EL DECRETO INTEGRA SU EXPEDIENTE.'
 ||cross_reference;

 IF p_method='digital' THEN
  INSERT INTO public.marginal_notes(
   sacrament_type,note_type,decree_number,content,parish_id,sacrament_id,note_date,
   source_type,source_id,decree_id,created_by,status,print_policy,print_default,is_locked,
   print_label,rendered_variables,legacy_source)
  VALUES('bautismo','decree_repetition',d.decree_number,note_content,parish,record_uuid,
   timezone('America/Bogota',now())::date,'decree',d.id,d.id,actor,'active',
   'required',true,true,'Repetición: partida sin efectos registrales',
   jsonb_build_object('decreeId',d.id,'entryIndex',p_entry_index,'book',entry->>'book',
    'folio',entry->>'folio','number',entry->>'number','disposition','without_effect'),
   jsonb_build_object('source','v315_repetition','evidence',evidence,'observation',observation))
   RETURNING id INTO note_uuid;
 END IF;

 actions:=jsonb_set(actions,ARRAY[entry_key],jsonb_build_object(
  'method',p_method,'outcome','note_recorded','noteId',note_uuid,
  'evidenceRef',evidence,'observations',observation,'actorAuthId',actor,
  'registeredAt',clock_timestamp(),'parishId',parish,'recordId',record_uuid,
  'noteContent',note_content),true);
 UPDATE public.decretos SET payload=payload||jsonb_build_object('repetitionEntryActions',actions),
 updated_at=clock_timestamp() WHERE id=d.id;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,
 entity_id,action,after_data,metadata)
 VALUES(actor,parish,di,'decree',d.id,'register_repetition_entry_marginal_v315',
 jsonb_build_object('entryIndex',p_entry_index,'method',p_method,'noteId',note_uuid,
  'recordId',record_uuid,'reference',evidence),
 jsonb_build_object('physicalAttestation',p_method='physical',
  'digitalMarginalCreated',p_method='digital','originalRecordPreserved',true));
 RETURN jsonb_build_object('decreeId',d.id,'entryIndex',p_entry_index,
  'method',p_method,'noteId',note_uuid,'status','note_recorded');
END $fn$;
COMMIT;
