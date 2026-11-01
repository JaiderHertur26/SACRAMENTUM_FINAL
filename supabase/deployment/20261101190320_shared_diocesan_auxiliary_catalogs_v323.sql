-- V323: cinco catálogos comunes por diócesis. Párrocos y Mis Datos siguen privados.
-- Conserva UUID, contenido y procedencia de todos los registros existentes.
CREATE SCHEMA IF NOT EXISTS sacramentum_private;
REVOKE ALL ON SCHEMA sacramentum_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA sacramentum_private TO authenticated;

CREATE OR REPLACE FUNCTION sacramentum_private.auxiliary_diocese_id_v323()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT CASE WHEN count(*) = 1 THEN (array_agg(up.diocese_id))[1] END
  FROM public.user_profiles up
  LEFT JOIN public.parishes p ON p.id = up.parish_id
  WHERE up.auth_user_id = (SELECT auth.uid()) AND up.is_active IS TRUE
    AND upper(up.status) = 'ACTIVE' AND up.diocese_id IS NOT NULL
    AND (lower(up.role) IN ('diocese','archdiocese','chancery')
      OR (lower(up.role) = 'parish' AND p.is_operational IS TRUE
        AND p.diocese_id = up.diocese_id));
$fn$;
REVOKE ALL ON FUNCTION sacramentum_private.auxiliary_diocese_id_v323() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sacramentum_private.auxiliary_diocese_id_v323() TO authenticated;

DO $migration$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['diocesis','iglesias','obispos','bishop_tenures','ciudades'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN diocese_id uuid REFERENCES public.dioceses(id) ON DELETE CASCADE',t);
    IF t = 'ciudades' THEN
      EXECUTE 'UPDATE public.ciudades c SET diocese_id=coalesce(
        (SELECT p.diocese_id FROM public.parishes p WHERE p.id=c.context_id),
        (SELECT d.id FROM public.dioceses d WHERE d.id=c.context_id))';
    ELSE
      EXECUTE format('UPDATE public.%I c SET diocese_id=p.diocese_id FROM public.parishes p WHERE p.id=c.parish_id',t);
    END IF;
    -- Un origen sin jurisdicción detiene la migración completa, sin adivinarla.
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN diocese_id SET NOT NULL',t);
    EXECUTE format('CREATE INDEX %I ON public.%I(diocese_id)', 'idx_v323_'||t||'_diocese',t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  END LOOP;
END $migration$;

-- La parroquia original queda como procedencia, no como propietaria del catálogo.
-- Su eliminación futura no puede borrar el catálogo común de las demás.
ALTER TABLE public.bishop_tenures ALTER COLUMN parish_id DROP NOT NULL;
ALTER TABLE public.diocesis DROP CONSTRAINT diocesis_parish_id_fkey;
ALTER TABLE public.diocesis ADD CONSTRAINT diocesis_parish_id_fkey FOREIGN KEY(parish_id) REFERENCES public.parishes(id) ON DELETE SET NULL;
ALTER TABLE public.iglesias DROP CONSTRAINT iglesias_parish_id_fkey;
ALTER TABLE public.iglesias ADD CONSTRAINT iglesias_parish_id_fkey FOREIGN KEY(parish_id) REFERENCES public.parishes(id) ON DELETE SET NULL;
ALTER TABLE public.obispos DROP CONSTRAINT obispos_parish_id_fkey;
ALTER TABLE public.obispos ADD CONSTRAINT obispos_parish_id_fkey FOREIGN KEY(parish_id) REFERENCES public.parishes(id) ON DELETE SET NULL;
ALTER TABLE public.bishop_tenures DROP CONSTRAINT bishop_tenures_parish_id_fkey;
ALTER TABLE public.bishop_tenures ADD CONSTRAINT bishop_tenures_parish_id_fkey FOREIGN KEY(parish_id) REFERENCES public.parishes(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX uq_v323_ciudades_diocese_name ON public.ciudades(diocese_id,(lower(trim(nombre))));
CREATE UNIQUE INDEX uq_v323_diocesis_diocese_name ON public.diocesis(diocese_id,(lower(trim(nombre))));
-- Un código diocesano legado puede corresponder a nombres distintos: se conserva.
CREATE UNIQUE INDEX uq_v323_iglesias_diocese_code ON public.iglesias(diocese_id,(lower(trim(codigo)))) WHERE nullif(trim(codigo),'') IS NOT NULL;
CREATE UNIQUE INDEX uq_v323_obispos_diocese_name ON public.obispos(diocese_id,(lower(trim(coalesce(nombre,'')||' '||coalesce(apellido,'')))));
CREATE INDEX idx_v323_bishop_diocese_dates ON public.bishop_tenures(diocese_id,start_date DESC,end_date);

CREATE OR REPLACE FUNCTION sacramentum_private.guard_auxiliary_scope_v323()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE origin_column text; origin_id uuid; old_origin uuid; derived_diocese uuid;
BEGIN
  origin_column := CASE WHEN TG_TABLE_NAME='ciudades' THEN 'context_id' ELSE 'parish_id' END;
  origin_id := (to_jsonb(NEW)->>origin_column)::uuid;
  IF TG_OP='UPDATE' THEN
    IF NEW.diocese_id IS DISTINCT FROM OLD.diocese_id THEN
      RAISE EXCEPTION 'No se puede trasladar un catálogo a otra diócesis.' USING ERRCODE='42501';
    END IF;
    old_origin := (to_jsonb(OLD)->>origin_column)::uuid;
    IF origin_id IS DISTINCT FROM old_origin AND
      (origin_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.parishes WHERE id=old_origin)) THEN
      RAISE EXCEPTION 'La procedencia del catálogo no se puede reasignar.' USING ERRCODE='42501';
    END IF;
  ELSE
    SELECT p.diocese_id INTO derived_diocese FROM public.parishes p WHERE p.id=origin_id;
    IF derived_diocese IS NULL AND TG_TABLE_NAME='ciudades' THEN
      SELECT d.id INTO derived_diocese FROM public.dioceses d WHERE d.id=origin_id;
    END IF;
    IF derived_diocese IS NULL THEN
      RAISE EXCEPTION 'El catálogo requiere una procedencia con diócesis válida.' USING ERRCODE='23514';
    END IF;
    IF NEW.diocese_id IS NOT NULL AND NEW.diocese_id<>derived_diocese THEN
      RAISE EXCEPTION 'La diócesis no corresponde a la procedencia del catálogo.' USING ERRCODE='42501';
    END IF;
    NEW.diocese_id := derived_diocese;
  END IF;
  IF TG_TABLE_NAME='bishop_tenures' THEN
    IF NEW.bishop_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.obispos b WHERE b.id=NEW.bishop_id AND b.diocese_id=NEW.diocese_id
    ) THEN
      RAISE EXCEPTION 'El Obispo pertenece a un catálogo de otra diócesis.' USING ERRCODE='23514';
    END IF;
  END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION sacramentum_private.guard_auxiliary_scope_v323() FROM PUBLIC, anon, authenticated;

DO $policies$
DECLARE t text; origin_column text; policy_row record; read_rule text; write_rule text; insert_rule text;
BEGIN
  FOREACH t IN ARRAY ARRAY['diocesis','iglesias','obispos','bishop_tenures','ciudades'] LOOP
    origin_column:=CASE WHEN t='ciudades' THEN 'context_id' ELSE 'parish_id' END;
    -- El trigger alfabéticamente anterior completa el ámbito antes del validador episcopal.
    EXECUTE format('CREATE TRIGGER aaa_auxiliary_scope_v323 BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION sacramentum_private.guard_auxiliary_scope_v323()',t);
    FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',policy_row.policyname,t);
    END LOOP;
    read_rule:='(diocese_id=(SELECT sacramentum_private.auxiliary_diocese_id_v323()) OR (SELECT public.is_app_admin()))';
    write_rule:='(diocese_id=(SELECT sacramentum_private.auxiliary_diocese_id_v323()) AND (SELECT public.current_app_role())=''parish'')';
    insert_rule:=write_rule||format(' AND %I=(SELECT public.current_app_parish_id())',origin_column);
    IF t='bishop_tenures' THEN
      write_rule:='((diocese_id=(SELECT sacramentum_private.auxiliary_diocese_id_v323()) AND (SELECT public.current_app_role()) IN (''parish'',''diocese'',''archdiocese'')) OR (SELECT public.is_app_admin()))';
      insert_rule:=write_rule;
    END IF;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',t||'_select_diocese_v323',t,read_rule);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',t||'_insert_diocese_v323',t,insert_rule);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',t||'_update_diocese_v323',t,write_rule,write_rule);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',t||'_delete_diocese_v323',t,write_rule);
  END LOOP;
END $policies$;

CREATE OR REPLACE FUNCTION public.sacramentum_validate_bishop_tenure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('auxiliary-bishop:'||NEW.diocese_id::text,0));
  IF EXISTS(SELECT 1 FROM public.bishop_tenures bt
    WHERE bt.diocese_id=NEW.diocese_id AND bt.id<>NEW.id
      AND daterange(bt.start_date,coalesce(bt.end_date,'infinity'::date),'[]')
        && daterange(NEW.start_date,coalesce(NEW.end_date,'infinity'::date),'[]')) THEN
    RAISE EXCEPTION 'Ya existe un Obispo titular para una parte de ese período en la diócesis.';
  END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.sacramentum_bishop_at_date(p_parish_id uuid,p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE r public.bishop_tenures%rowtype; v_date date:=coalesce(p_date,current_date); scope_id uuid;
BEGIN
  SELECT p.diocese_id INTO scope_id FROM public.parishes p WHERE p.id=p_parish_id;
  IF scope_id IS NULL THEN RETURN NULL; END IF;
  IF auth.uid() IS NOT NULL THEN
    IF NOT coalesce(public.is_app_admin() OR scope_id=sacramentum_private.auxiliary_diocese_id_v323(),false) THEN
      RAISE EXCEPTION 'No autorizado para consultar el historial episcopal.' USING ERRCODE='42501';
    END IF;
  ELSIF current_setting('role',true) IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'Se requiere una identidad activa.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO r FROM public.bishop_tenures bt
    WHERE bt.diocese_id=scope_id AND bt.start_date<=v_date
      AND (bt.end_date IS NULL OR bt.end_date>=v_date)
    ORDER BY bt.start_date DESC,bt.created_at DESC LIMIT 1;
  IF r.id IS NULL THEN
    SELECT * INTO r FROM public.bishop_tenures bt
      WHERE bt.diocese_id=scope_id AND bt.start_date<=v_date
      ORDER BY bt.start_date DESC,bt.created_at DESC LIMIT 1;
  END IF;
  IF r.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id',r.id,'bishopId',r.bishop_id,
    'nombreCompleto',upper(r.bishop_name),'fechaInicio',r.start_date,'fechaFin',r.end_date,'notes',r.notes);
END $fn$;

-- Los materializadores de importación usan la identidad común de cada catálogo.
CREATE OR REPLACE FUNCTION public.materialize_auxiliary_catalog_batch(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  b public.legacy_import_batches%rowtype;
  r public.legacy_import_rows%rowtype;
  d jsonb;
  v_count integer:=0;
  v_name text;
begin
  select * into b from public.legacy_import_batches where id=p_batch_id;
  if not found then raise exception 'Lote no encontrado'; end if;
  if b.parish_id is null then raise exception 'La parroquia propietaria es obligatoria'; end if;
  if auth.uid() is not null and not public.can_manage_legacy_import(b.parish_id,b.diocese_id) then
    raise exception 'No autorizado para materializar este lote';
  end if;

  if b.profile_key not in ('PARROCOS','IGLESIAS','CIUDADES','OBISPOS') then
    return jsonb_build_object('profile',b.profile_key,'materialized',0,'skipped',true);
  end if;

  for r in select * from public.legacy_import_rows
    where batch_id=p_batch_id and status='imported'
    order by row_number
  loop
    d:=coalesce(r.normalized_data,'{}'::jsonb);

    if b.profile_key='PARROCOS' then
      v_name:=upper(trim(coalesce(d->>'priest_name','')));
      if v_name<>'' then
        insert into public.parrocos(
          parish_id,nombre,apellido,fecha_ingreso,fecha_salida,estado,payload,created_at
        ) values(
          b.parish_id,v_name,'',
          nullif(d->>'service_start','')::date,
          nullif(d->>'service_end','')::date,
          'HISTORICO',
          jsonb_build_object(
            'legacy_code',d->>'legacy_code',
            'legacy_grade',d->>'legacy_grade',
            'legacy_state',d->>'legacy_state',
            'source','legacy_migration',
            'batch_id',p_batch_id,
            'source_sha256',b.sha256
          ),
          now()
        )
        on conflict (parish_id,(payload->>'legacy_code'))
        where nullif(payload->>'legacy_code','') is not null
        do update set
          nombre=excluded.nombre,
          fecha_ingreso=excluded.fecha_ingreso,
          fecha_salida=excluded.fecha_salida,
          payload=public.parrocos.payload||excluded.payload;
        v_count:=v_count+1;
      end if;

    elsif b.profile_key='IGLESIAS' then
      if nullif(d->>'name','') is not null then
        insert into public.iglesias(
          parish_id,codigo,nombre,nit,direccion,ciudad,telefono,fax,email,parroco,diocesis,created_at
        ) values(
          b.parish_id,nullif(d->>'legacy_code',''),upper(d->>'name'),
          nullif(d->>'nit',''),nullif(d->>'address',''),upper(coalesce(d->>'city','')),
          nullif(d->>'phone',''),nullif(d->>'fax',''),nullif(d->>'email',''),
          upper(coalesce(d->>'priest_name','')),nullif(d->>'diocese_legacy_code',''),now()
        )
        on conflict(diocese_id,(lower(trim(codigo)))) where nullif(trim(codigo),'') is not null
        do update set
          nombre=excluded.nombre,nit=excluded.nit,direccion=excluded.direccion,
          ciudad=excluded.ciudad,telefono=excluded.telefono,fax=excluded.fax,
          email=excluded.email,parroco=excluded.parroco,diocesis=excluded.diocesis,
          updated_at=now();
        v_count:=v_count+1;
      end if;

    elsif b.profile_key='CIUDADES' then
      if nullif(d->>'value','') is not null then
        insert into public.ciudades(
          context_id,nombre,source,count,weight,usuario,created_at
        ) values(
          b.parish_id,upper(d->>'value'),coalesce(nullif(d->>'source',''),'legacy_migration'),
          coalesce(nullif(d->>'usage_count','')::integer,0),
          coalesce(nullif(d->>'weight','')::integer,0),
          nullif(d->>'source_user',''),now()
        )
        on conflict(diocese_id,(lower(trim(nombre))))
        do update set count=greatest(public.ciudades.count,excluded.count),
          weight=greatest(public.ciudades.weight,excluded.weight),updated_at=now();
        v_count:=v_count+1;
      end if;

    elsif b.profile_key='OBISPOS' then
      v_name:=upper(trim(coalesce(d->>'nombre',d->>'name','')));
      if v_name<>'' then
        insert into public.obispos(
          parish_id,nombre,apellido,diocesis,fecha_nombramiento,fecha_salida,email,source_metadata,created_at
        ) values(
          b.parish_id,v_name,upper(trim(coalesce(d->>'apellido',d->>'last_name',''))),
          upper(trim(coalesce(d->>'diocesis',d->>'diocese',''))),
          nullif(coalesce(d->>'fechaNombramiento',d->>'fecha_nombramiento',d->>'fecing'),'')::date,
          nullif(coalesce(d->>'fechaSalida',d->>'fecha_salida',d->>'fecsal'),'')::date,
          nullif(d->>'email',''),
          jsonb_build_object('source','legacy_migration','batch_id',p_batch_id,'source_sha256',b.sha256),
          now()
        )
        on conflict(diocese_id,(lower(trim(coalesce(nombre,'')||' '||coalesce(apellido,'')))))
        do update set diocesis=excluded.diocesis,
          fecha_nombramiento=coalesce(excluded.fecha_nombramiento,public.obispos.fecha_nombramiento),
          fecha_salida=coalesce(excluded.fecha_salida,public.obispos.fecha_salida),
          email=coalesce(excluded.email,public.obispos.email),
          source_metadata=public.obispos.source_metadata||excluded.source_metadata,
          updated_at=now();
        v_count:=v_count+1;
      end if;
    end if;
  end loop;

  if b.profile_key='PARROCOS' then
    perform public.sacramentum_recalculate_current_priest(b.parish_id);
  end if;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values(
    auth.uid(),b.parish_id,b.diocese_id,'legacy_import_batch',p_batch_id,
    'auxiliary_catalog_materialized',
    jsonb_build_object('profile_key',b.profile_key,'materialized',v_count),
    jsonb_build_object('filename',b.original_filename,'sha256',b.sha256)
  );

  return jsonb_build_object('profile',b.profile_key,'materialized',v_count,'parish_id',b.parish_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.materialize_diocesis_catalog_batch(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  b public.legacy_import_batches%rowtype;
  r public.legacy_import_rows%rowtype;
  d jsonb;
  v_count integer:=0;
begin
  select * into b from public.legacy_import_batches where id=p_batch_id;
  if not found then raise exception 'Lote no encontrado'; end if;
  if b.parish_id is null then raise exception 'La parroquia propietaria es obligatoria'; end if;

  if b.profile_key<>'DIOCESIS' then
    return jsonb_build_object('profile',b.profile_key,'materialized',0,'skipped',true);
  end if;

  if auth.uid() is not null and not public.can_manage_legacy_import(b.parish_id,b.diocese_id) then
    raise exception 'No autorizado para materializar este lote';
  end if;

  for r in
    select * from public.legacy_import_rows
    where batch_id=p_batch_id and status='imported'
    order by row_number
  loop
    d:=coalesce(r.normalized_data,'{}'::jsonb);
    if nullif(d->>'name','') is not null then
      insert into public.diocesis(
        parish_id,codigo,nombre,region,descripcion,created_at,updated_at
      ) values(
        b.parish_id,
        nullif(d->>'legacy_code',''),
        upper(trim(d->>'name')),
        upper(trim(coalesce(d->>'city',''))),
        concat_ws(' · ',
          nullif(trim(coalesce(d->>'address','')),''),
          nullif(trim(coalesce(d->>'phone','')),''),
          nullif(trim(coalesce(d->>'email','')),'')
        ),
        now(),now()
      )
      on conflict(diocese_id,(lower(trim(nombre))))
      do update set
        region=excluded.region,
        descripcion=excluded.descripcion,
        updated_at=now();
      v_count:=v_count+1;
    end if;
  end loop;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values(
    auth.uid(),b.parish_id,b.diocese_id,'legacy_import_batch',p_batch_id,
    'auxiliary_catalog_materialized',
    jsonb_build_object('profile_key','DIOCESIS','materialized',v_count),
    jsonb_build_object('filename',b.original_filename,'sha256',b.sha256)
  );

  return jsonb_build_object(
    'profile','DIOCESIS','materialized',v_count,'parish_id',b.parish_id
  );
end;
$function$;
