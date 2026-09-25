-- SACRAMENTUM · CONFIRMACIÓN · CONSECUTIVOS INMUTABLES
-- Refuerza save_confirmation_parameters sin cambiar su firma pública.
-- Aplicar únicamente al proyecto REGISTRO SACRAMENTOS (foczofcmwampjvlfbsqn).

create or replace function public.save_confirmation_parameters(
  p_parish_id uuid,
  p_params jsonb,
  p_expected_book integer default null,
  p_expected_folio integer default null,
  p_expected_number integer default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_user_parish uuid;
  v_row public.parish_parameters%rowtype;
  v_current jsonb;
  v_new jsonb;
  v_book integer;
  v_folio integer;
  v_number integer;
  v_cur_book integer;
  v_cur_folio integer;
  v_cur_number integer;
  v_sup_book integer;
  v_sup_folio integer;
  v_sup_number integer;
  v_cur_sup_book integer;
  v_cur_sup_folio integer;
  v_cur_sup_number integer;
  v_expected_sup_book integer;
  v_expected_sup_folio integer;
  v_expected_sup_number integer;
  v_input jsonb;
  v_limit integer;
  v_reg bigint;
  v_max_reg bigint:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_parish_id is null then raise exception 'Parroquia no válida'; end if;
  if p_params is null or jsonb_typeof(p_params)<>'object' then raise exception 'Parámetros de Confirmación no válidos'; end if;

  select lower(coalesce(role,'')),parish_id into v_role,v_user_parish
  from public.user_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)=true
    and coalesce(status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role<>'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede modificar sus parámetros de Confirmación';
  end if;

  perform public.sacramentum_ensure_parish_parameters(p_parish_id);
  select * into v_row from public.parish_parameters where parish_id=p_parish_id for update;
  if not found then raise exception 'Parámetros de la parroquia no encontrados'; end if;

  v_current:=coalesce(v_row.confirmaciones_params,public.sacramentum_default_confirmation_params());
  v_cur_book:=greatest(coalesce(nullif(v_current->>'ordinarioLibro','')::integer,1),1);
  v_cur_folio:=greatest(coalesce(nullif(v_current->>'ordinarioFolio','')::integer,1),1);
  v_cur_number:=greatest(coalesce(nullif(v_current->>'ordinarioNumero','')::integer,1),1);
  v_cur_sup_book:=greatest(coalesce(nullif(v_current->>'suplementarioLibro','')::integer,1),1);
  v_cur_sup_folio:=greatest(coalesce(nullif(v_current->>'suplementarioFolio','')::integer,1),1);
  v_cur_sup_number:=greatest(coalesce(nullif(v_current->>'suplementarioNumero','')::integer,1),1);
  v_expected_sup_book:=nullif(p_params->>'_expectedSuplementarioLibro','')::integer;
  v_expected_sup_folio:=nullif(p_params->>'_expectedSuplementarioFolio','')::integer;
  v_expected_sup_number:=nullif(p_params->>'_expectedSuplementarioNumero','')::integer;

  if p_expected_book is not null and greatest(coalesce(nullif(v_current->>'ordinarioLibro','')::integer,1),1)<>p_expected_book then
    raise exception 'El Libro cambió en otra sesión. Recargue los parámetros.';
  end if;
  if p_expected_folio is not null and greatest(coalesce(nullif(v_current->>'ordinarioFolio','')::integer,1),1)<>p_expected_folio then
    raise exception 'El Folio cambió en otra sesión. Recargue los parámetros.';
  end if;
  if p_expected_number is not null and greatest(coalesce(nullif(v_current->>'ordinarioNumero','')::integer,1),1)<>p_expected_number then
    raise exception 'El Número cambió en otra sesión. Recargue los parámetros.';
  end if;

  if v_expected_sup_book is not null and v_cur_sup_book<>v_expected_sup_book then raise exception 'El Libro Supletorio cambió en otra sesión. Recargue los parámetros.'; end if;
  if v_expected_sup_folio is not null and v_cur_sup_folio<>v_expected_sup_folio then raise exception 'El Folio Supletorio cambió en otra sesión. Recargue los parámetros.'; end if;
  if v_expected_sup_number is not null and v_cur_sup_number<>v_expected_sup_number then raise exception 'El Número Supletorio cambió en otra sesión. Recargue los parámetros.'; end if;

  v_input:=p_params-'_expectedSuplementarioLibro'-'_expectedSuplementarioFolio'-'_expectedSuplementarioNumero';
  v_new:=public.sacramentum_default_confirmation_params()||v_current||v_input;
  v_book:=greatest(coalesce(nullif(v_new->>'ordinarioLibro','')::integer,1),1);
  v_folio:=greatest(coalesce(nullif(v_new->>'ordinarioFolio','')::integer,1),1);
  v_number:=greatest(coalesce(nullif(v_new->>'ordinarioNumero','')::integer,1),1);
  v_sup_book:=greatest(coalesce(nullif(v_new->>'suplementarioLibro','')::integer,1),1);
  v_sup_folio:=greatest(coalesce(nullif(v_new->>'suplementarioFolio','')::integer,1),1);
  v_sup_number:=greatest(coalesce(nullif(v_new->>'suplementarioNumero','')::integer,1),1);
  v_limit:=greatest(coalesce(nullif(v_new->>'ordinarioPartidas','')::integer,2),1);

  if row(v_book,v_folio,v_number) < row(v_cur_book,v_cur_folio,v_cur_number) then raise exception 'El consecutivo ordinario no puede retroceder de L %, F %, N % a L %, F %, N %',v_cur_book,v_cur_folio,v_cur_number,v_book,v_folio,v_number; end if;
  if row(v_sup_book,v_sup_folio,v_sup_number) < row(v_cur_sup_book,v_cur_sup_folio,v_cur_sup_number) then raise exception 'El consecutivo supletorio no puede retroceder de L %, F %, N % a L %, F %, N %',v_cur_sup_book,v_cur_sup_folio,v_cur_sup_number,v_sup_book,v_sup_folio,v_sup_number; end if;

  if v_limit<1 then raise exception 'Partidas por folio debe ser mayor que cero'; end if;

  if exists(
    select 1 from public.confirmations c
    where c.parish_id=p_parish_id
      and c.book_number=lpad(v_book::text,4,'0')
      and c.folio=lpad(v_folio::text,4,'0')
      and c.number=lpad(v_number::text,4,'0')
  ) then
    raise exception 'El consecutivo ordinario propuesto L %, F %, N % ya está ocupado',v_book,v_folio,v_number;
  end if;

  if exists(
    select 1 from public.confirmations c
    where c.parish_id=p_parish_id
      and c.book_number=lpad(v_sup_book::text,4,'0')
      and c.folio=lpad(v_sup_folio::text,4,'0')
      and c.number=lpad(v_sup_number::text,4,'0')
  ) then
    raise exception 'El consecutivo supletorio propuesto L %, F %, N % ya está ocupado',v_sup_book,v_sup_folio,v_sup_number;
  end if;

  select greatest(
    coalesce((select max(numero_registro::bigint) from public.confirmations where parish_id=p_parish_id and numero_registro ~ '^[0-9]+$'),0),
    coalesce((select max((raw_data->>'numeroRegistro')::bigint) from public.pending_confirmations where parish_id=p_parish_id and coalesce(raw_data->>'numeroRegistro','') ~ '^[0-9]+$'),0),
    coalesce((select max((raw_data->>'numero_registro')::bigint) from public.pending_confirmations where parish_id=p_parish_id and coalesce(raw_data->>'numero_registro','') ~ '^[0-9]+$'),0)
  ) into v_max_reg;

  v_reg:=coalesce(nullif(regexp_replace(coalesce(v_new->>'numeroRegistroActual',''),'[^0-9]','','g'),'')::bigint,0);
  if v_reg<v_max_reg then
    raise exception 'El Número de Registro no puede retroceder por debajo de %',lpad(v_max_reg::text,6,'0');
  end if;
  v_new:=jsonb_set(v_new,'{numeroRegistroActual}',to_jsonb(lpad(v_reg::text,6,'0')),true);

  update public.parish_parameters
  set confirmaciones_params=v_new,updated_at=now()
  where id=v_row.id;

  return v_new;
end;
$$;

revoke all on function public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer) from public, anon;
grant execute on function public.save_confirmation_parameters(uuid,jsonb,integer,integer,integer) to authenticated, service_role;
