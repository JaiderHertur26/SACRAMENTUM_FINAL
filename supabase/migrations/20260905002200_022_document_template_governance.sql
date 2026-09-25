-- ============================================================================
-- SACRAMENTUM · Fase 3.22 · Gobierno versionado de plantillas documentales
-- ============================================================================

create or replace function public.save_document_template(
  p_code text,
  p_name text,
  p_category text,
  p_template_text text,
  p_scope_type text default 'diocese',
  p_diocese_id uuid default null,
  p_parish_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text; v_scope text:=lower(trim(coalesce(p_scope_type,'diocese')));
  v_diocese uuid:=p_diocese_id; v_parish uuid:=p_parish_id;
  v_version integer; v_id uuid; v_vars text[];
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if nullif(trim(coalesce(p_code,'')),'') is null then raise exception 'Código requerido'; end if;
  if nullif(trim(coalesce(p_name,'')),'') is null then raise exception 'Nombre requerido'; end if;
  if nullif(trim(coalesce(p_template_text,'')),'') is null then raise exception 'Texto requerido'; end if;
  if v_scope not in ('system','diocese','parish') then raise exception 'Ámbito inválido'; end if;
  v_role:=public.current_app_role();

  if v_role='admin_general' then
    null;
  elsif v_role in ('diocese','chancery') then
    if v_scope<>'diocese' then raise exception 'Diócesis/Cancillería sólo administra plantillas diocesanas'; end if;
    v_diocese:=public.current_app_diocese_id(); v_parish:=null;
  elsif v_role='parish' then
    if v_scope<>'parish' then raise exception 'La parroquia sólo administra plantillas locales'; end if;
    v_parish:=public.current_app_parish_id();
    select diocese_id into v_diocese from public.parishes where id=v_parish;
  else raise exception 'Rol no autorizado';
  end if;

  if v_scope='system' then v_diocese:=null; v_parish:=null; end if;
  if v_scope='diocese' and v_diocese is null then raise exception 'Diócesis requerida'; end if;
  if v_scope='parish' and v_parish is null then raise exception 'Parroquia requerida'; end if;

  select coalesce(max(version),0)+1 into v_version
  from public.document_templates
  where upper(code)=upper(trim(p_code)) and scope_type=v_scope
    and diocese_id is not distinct from v_diocese and parish_id is not distinct from v_parish;

  update public.document_templates set is_active=false,updated_at=now()
  where upper(code)=upper(trim(p_code)) and scope_type=v_scope
    and diocese_id is not distinct from v_diocese and parish_id is not distinct from v_parish and is_active=true;

  select coalesce(array_agg(distinct x[1]),'{}'::text[]) into v_vars
  from regexp_matches(p_template_text,'<([^>]+)>','g') x;

  insert into public.document_templates(code,name,category,template_text,variables,scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata,created_by)
  values(upper(trim(p_code)),trim(p_name),lower(trim(coalesce(p_category,'document'))),trim(p_template_text),v_vars,v_scope,v_diocese,v_parish,v_version,true,false,coalesce(p_metadata,'{}'::jsonb),auth.uid())
  returning id into v_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),v_parish,v_diocese,'document_template',v_id,'document_template_version_created',
         jsonb_build_object('code',upper(trim(p_code)),'version',v_version,'category',lower(trim(coalesce(p_category,'document'))),'scope_type',v_scope),coalesce(p_metadata,'{}'::jsonb));
  return v_id;
end;
$$;
revoke all on function public.save_document_template(text,text,text,text,text,uuid,uuid,jsonb) from public;
grant execute on function public.save_document_template(text,text,text,text,text,uuid,uuid,jsonb) to authenticated;

revoke insert,update,delete on public.document_templates from authenticated;
