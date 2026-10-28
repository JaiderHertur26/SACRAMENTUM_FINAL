-- V275 disposable PG16 reproduction of core live Supabase behavior:
-- trg_validate_funeral_baptism, trg_sync_baptism_death_from_funeral.
-- This is a test-only approximation; no DDL is executed on live Supabase.
CREATE FUNCTION public.sacramentum_validate_funeral_baptism_link()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
 v_source uuid;
 v_b public.baptisms%rowtype;
BEGIN
 v_source:=nullif(coalesce(new.baptism_id::text,
   new.raw_data->>'baptism_record_id',new.raw_data->>'baptismRecordId',''),'')::uuid;
 IF v_source IS NULL THEN RETURN new; END IF;
 SELECT * INTO v_b FROM public.baptisms WHERE id=v_source
   AND parish_id=new.parish_id AND lower(coalesce(status,'seated'))
   NOT IN('anulada','annulled','reversed','deleted') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'V275: referencia a Bautismo ausente o de otra parroquia'; END IF;
 IF lower(trim(coalesce(v_b.nombres,'')))<>lower(trim(coalesce(new.nombres,'')))
   OR lower(trim(coalesce(v_b.apellidos,'')))<>lower(trim(coalesce(new.apellidos,''))) THEN
    RAISE EXCEPTION 'V275: identidad de Exequias y Bautismo no coincide'; END IF;
 IF new.fecha_defuncion<coalesce(v_b.fecha_nacimiento,v_b.celebration_date)
    OR new.fecha_defuncion<v_b.celebration_date THEN
    RAISE EXCEPTION 'V275: defunción anterior al Bautismo o nacimiento'; END IF;
 IF coalesce(v_b.is_deceased,false) AND v_b.linked_funeral_id IS NOT NULL
    AND v_b.linked_funeral_id<>new.id THEN
    RAISE EXCEPTION 'V275: Bautismo ya asociado a otra Exequia'; END IF;
 new.baptism_id:=v_source;
 new.raw_data:=coalesce(new.raw_data,'{}'::jsonb)||
   jsonb_build_object('baptism_record_id',v_source);
 RETURN new;
END $fn$;
CREATE TRIGGER trg_validate_funeral_baptism
 BEFORE INSERT ON public.funerals FOR EACH ROW
 EXECUTE FUNCTION public.sacramentum_validate_funeral_baptism_link();

CREATE FUNCTION public.sacramentum_sync_baptism_death_from_funeral()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE v_note text;
BEGIN
 IF new.baptism_id IS NULL THEN RETURN new; END IF;
 v_note:='FALLECIÓ EL '||to_char(new.fecha_defuncion,'DD/MM/YYYY')
  ||'. EXEQUIAS REGISTRADAS EN LIBRO '||new.book_number||
  ', FOLIO '||new.folio||', NÚMERO '||new.number||'.';
 UPDATE public.baptisms
 SET is_deceased=true,death_date=new.fecha_defuncion,
  death_place=new.lugar_defuncion,linked_funeral_id=new.id,
  nota_marginal=concat_ws(E'\n\n',nullif(nota_marginal,''),v_note),
  raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
   'isDeceased',true,'linkedFuneralId',new.id,'fechaDefuncion',new.fecha_defuncion)
 WHERE id=new.baptism_id AND parish_id=new.parish_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'V275: no se pudo actualizar Bautismo'; END IF;
 INSERT INTO public.marginal_notes(sacrament_type,note_type,content,parish_id,
  sacrament_id,note_date,source_type,source_id,created_by,status)
 VALUES('bautismo','defuncion',v_note,new.parish_id,new.baptism_id,
  new.fecha_defuncion,'funeral',new.id,auth.uid(),'active');
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,entity_type,
  entity_id,action,after_data,metadata)
 VALUES(auth.uid(),new.parish_id,'baptism',new.baptism_id,
  'mark_deceased_from_funeral',
  jsonb_build_object('is_deceased',true,'death_date',new.fecha_defuncion),
  jsonb_build_object('funeral_id',new.id,'book',new.book_number));
 RETURN new;
END $fn$;
CREATE TRIGGER trg_sync_baptism_death_from_funeral
 AFTER INSERT ON public.funerals FOR EACH ROW
 EXECUTE FUNCTION public.sacramentum_sync_baptism_death_from_funeral();
