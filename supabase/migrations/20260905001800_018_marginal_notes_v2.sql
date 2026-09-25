-- ============================================================================
-- SACRAMENTUM · Fase 3.18 · Motor profesional de notas marginales V2
-- Múltiples notas por partida, plantillas versionadas, cláusulas opcionales y
-- política explícita de impresión (required / optional / internal).
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Plantillas versionadas por ámbito.
-- --------------------------------------------------------------------------
create table if not exists public.marginal_note_templates (
  id uuid primary key default gen_random_uuid(),
  code varchar(100) not null,
  name varchar(240) not null,
  sacrament_type varchar(40) not null default 'any',
  event_type varchar(80) not null,
  scope_type varchar(20) not null default 'system',
  diocese_id uuid references public.dioceses(id) on delete cascade,
  parish_id uuid references public.parishes(id) on delete cascade,
  base_text text not null,
  print_policy varchar(20) not null default 'optional',
  print_default boolean not null default true,
  is_fixed boolean not null default true,
  allows_clauses boolean not null default true,
  version integer not null default 1,
  is_active boolean not null default true,
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marginal_note_template_scope_ck check (scope_type in ('system','diocese','parish')),
  constraint marginal_note_template_policy_ck check (print_policy in ('required','optional','internal'))
);

create unique index if not exists uq_marginal_template_scope_version
on public.marginal_note_templates(
  code, version, scope_type,
  coalesce(diocese_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parish_id,'00000000-0000-0000-0000-000000000000'::uuid)
);
create index if not exists idx_marginal_templates_lookup
  on public.marginal_note_templates(sacrament_type,event_type,is_active,scope_type);

create table if not exists public.marginal_note_template_clauses (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.marginal_note_templates(id) on delete cascade,
  code varchar(100) not null,
  label varchar(240) not null,
  clause_text text not null,
  placement varchar(20) not null default 'after',
  is_required boolean not null default false,
  enabled_by_default boolean not null default false,
  sort_order integer not null default 0,
  condition_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_id, code),
  constraint marginal_clause_placement_ck check (placement in ('before','after','inline'))
);

-- --------------------------------------------------------------------------
-- 2. Ampliar marginal_notes conservando columnas históricas.
-- --------------------------------------------------------------------------
alter table if exists public.marginal_notes
  add column if not exists template_id uuid references public.marginal_note_templates(id) on delete set null,
  add column if not exists template_version integer,
  add column if not exists print_policy varchar(20) not null default 'optional',
  add column if not exists print_default boolean not null default true,
  add column if not exists is_locked boolean not null default false,
  add column if not exists print_label varchar(240),
  add column if not exists rendered_variables jsonb not null default '{}'::jsonb,
  add column if not exists clause_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists legacy_source jsonb not null default '{}'::jsonb,
  add column if not exists sort_order integer not null default 0;

-- Si la tabla existía antes de Fase 2.4, garantizar status/updated_at.
alter table if exists public.marginal_notes
  add column if not exists status varchar(32) not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.marginal_notes
  drop constraint if exists marginal_notes_print_policy_ck;
alter table if exists public.marginal_notes
  add constraint marginal_notes_print_policy_ck check (print_policy in ('required','optional','internal'));

create index if not exists idx_marginal_notes_print
  on public.marginal_notes(sacrament_type,sacrament_id,status,print_policy,sort_order,created_at);

-- Notas jurídicas existentes deben imprimirse por defecto y quedar bloqueadas.
update public.marginal_notes
set print_policy = case
      when lower(coalesce(source_type,'')) in ('decree','marriage_nullity','matrimonial_notification')
        or decree_id is not null then 'required'
      else coalesce(nullif(print_policy,''),'optional')
    end,
    print_default = case
      when lower(coalesce(source_type,'')) in ('decree','marriage_nullity','matrimonial_notification')
        or decree_id is not null then true
      else coalesce(print_default,true)
    end,
    is_locked = case
      when lower(coalesce(source_type,'')) in ('decree','marriage_nullity','matrimonial_notification')
        or decree_id is not null then true
      else coalesce(is_locked,false)
    end
where coalesce(status,'active') <> 'reversed';

-- --------------------------------------------------------------------------
-- 3. Plantillas base del sistema. Versionadas y no destructivas.
-- --------------------------------------------------------------------------
insert into public.marginal_note_templates(
  code,name,sacrament_type,event_type,scope_type,base_text,print_policy,print_default,is_fixed,allows_clauses,version,metadata
)
values
('CORRECTION_ORIGINAL','Corrección · partida original','any','correction_original','system',
 'PARTIDA ANULADA POR DECRETO NO. [NUMERO_DECRETO] DEL [FECHA_DECRETO] DE [OFICINA_EXPIDE]. LA INFORMACIÓN CORREGIDA PASA AL L-[LIBRO_NUEVA] F-[FOLIO_NUEVA] N-[NUMERO_NUEVA].',
 'required',true,true,true,1,'{"legal":true}'::jsonb),
('CORRECTION_REPLACEMENT','Corrección · partida supletoria','any','correction_replacement','system',
 'ESTA PARTIDA SE INSCRIBE POR DECRETO DE CORRECCIÓN NO. [NUMERO_DECRETO] DEL [FECHA_DECRETO], Y ANULA LA PARTIDA ORIGINAL DEL L-[LIBRO_ANULADA] F-[FOLIO_ANULADA] N-[NUMERO_ANULADA].',
 'required',true,true,true,1,'{"legal":true}'::jsonb),
('REPLACEMENT_NEW','Reposición · partida nueva','any','replacement','system',
 'ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. [NUMERO_DECRETO] DEL [FECHA_DECRETO] DE [OFICINA_EXPIDE], DEBIDO A PÉRDIDA O DETERIORO DEL ORIGINAL.',
 'required',true,true,true,1,'{"legal":true}'::jsonb),
('BAPTISM_CONFIRMATION','Confirmación recibida','bautismo','confirmation','system',
 'EL [FECHA_CONFIRMACION] RECIBIÓ EL SACRAMENTO DE LA CONFIRMACIÓN EN [PARROQUIA_CONFIRMACION], [DIOCESIS_CONFIRMACION]. L-[LIBRO_CONF], F-[FOLIO_CONF], N-[NUMERO_CONF].',
 'optional',true,true,true,1,'{"crossSacrament":true}'::jsonb),
('BAPTISM_MARRIAGE','Matrimonio notificado al Bautismo','bautismo','marriage_notification','system',
 'EL [FECHA_NOTIFICACION] SE RECIBIÓ NOTIFICACIÓN DE QUE CONTRAJO MATRIMONIO CON [NOMBRE_CONYUGE] EL [FECHA_MATRIMONIO] EN [PARROQUIA_MATRIMONIO], [DIOCESIS_MATRIMONIO]. L-[LIBRO_MAT], F-[FOLIO_MAT], N-[NUMERO_MAT].',
 'required',true,true,true,1,'{"legal":true,"crossSacrament":true}'::jsonb),
('MARRIAGE_NULLITY','Nulidad matrimonial en la partida de Matrimonio','matrimonio','marriage_nullity','system',
 'ESTE MATRIMONIO FUE DECLARADO NULO MEDIANTE SENTENCIA DEL TRIBUNAL ECLESIÁSTICO. DECRETO / SENTENCIA NO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO].',
 'required',true,true,true,1,'{"legal":true}'::jsonb),
('BAPTISM_MARRIAGE_NULLITY','Nulidad matrimonial al margen del Bautismo','bautismo','marriage_nullity','system',
 'EL MATRIMONIO CON [NOMBRE_CONYUGE] FUE DECLARADO NULO MEDIANTE SENTENCIA DEL TRIBUNAL ECLESIÁSTICO. DECRETO / SENTENCIA NO. [NUMERO_DECRETO] DEL [FECHA_DECRETO].',
 'required',true,true,true,1,'{"legal":true,"crossSacrament":true}'::jsonb),
('CIVIL_REGISTRY','Vínculo de Registro Civil','bautismo','civil_registry','system',
 'REGISTRO CIVIL: NUIP/NIP [NUIP]. SERIAL [SERIAL_ACTA]. EXPEDIDO EN [OFICINA_REGISTRO] EL [FECHA_EXPEDICION_RC].',
 'optional',false,true,true,1,'{"civil":true}'::jsonb),
('HOLY_ORDERS','Orden sagrado / profesión religiosa','bautismo','holy_orders','system',
 'RECIBIÓ EL ORDEN SAGRADO / PROFESIÓN RELIGIOSA EL [FECHA_ORDEN] EN [LUGAR_ORDEN]. [DIOCESIS_ORDEN].',
 'required',true,true,true,1,'{"legal":true,"crossSacrament":true}'::jsonb),
('MANUAL_NOTE','Nota marginal libre','any','manual','system',
 '[TEXTO_NOTA]',
 'optional',true,false,false,1,'{"manual":true}'::jsonb)
on conflict do nothing;

-- Cláusulas opcionales reutilizables en notas jurídicas.
insert into public.marginal_note_template_clauses(template_id,code,label,clause_text,placement,is_required,enabled_by_default,sort_order)
select t.id,'DA_FE','Agregar “Da fe”','DA FE: [MINISTRO].','after',false,true,10
from public.marginal_note_templates t where t.code in ('CORRECTION_REPLACEMENT','REPLACEMENT_NEW') and t.scope_type='system' and t.version=1
on conflict do nothing;

insert into public.marginal_note_template_clauses(template_id,code,label,clause_text,placement,is_required,enabled_by_default,sort_order)
select t.id,'OBSERVATION','Observación adicional','OBSERVACIÓN: [OBSERVACION].','after',false,false,20
from public.marginal_note_templates t where t.code in ('CORRECTION_ORIGINAL','CORRECTION_REPLACEMENT','REPLACEMENT_NEW','MARRIAGE_NULLITY') and t.scope_type='system' and t.version=1
on conflict do nothing;

-- --------------------------------------------------------------------------
-- 4. RPC para crear notas manuales/administrativas con autorización estricta.
-- Notas jurídicas generadas por decretos siguen naciendo desde sus RPC propias.
-- --------------------------------------------------------------------------
create or replace function public.create_manual_marginal_note(
  p_parish_id uuid,
  p_sacrament_type text,
  p_sacrament_id uuid,
  p_content text,
  p_note_date date default current_date,
  p_print_policy text default 'optional',
  p_print_default boolean default true,
  p_label text default null,
  p_template_id uuid default null,
  p_variables jsonb default '{}'::jsonb,
  p_clause_snapshot jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_id uuid;
  v_diocese uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_parish_id is null or p_sacrament_id is null then raise exception 'Parroquia y partida son obligatorias'; end if;
  if nullif(trim(coalesce(p_content,'')),'') is null then raise exception 'El texto de la nota es obligatorio'; end if;
  if lower(coalesce(p_print_policy,'')) not in ('required','optional','internal') then raise exception 'Política de impresión inválida'; end if;

  v_role := public.current_app_role();
  v_diocese := public.current_app_diocese_id();
  if not public.can_access_parish(p_parish_id) then raise exception 'Fuera de jurisdicción'; end if;
  if v_role not in ('parish','chancery','diocese','admin_general') then raise exception 'Rol no autorizado'; end if;
  if v_role='parish' and p_parish_id is distinct from public.current_app_parish_id() then raise exception 'La parroquia sólo puede trabajar su propio archivo'; end if;
  if lower(p_print_policy)='required' and v_role='parish' then
    raise exception 'Las notas de impresión obligatoria requieren autoridad de Cancillería/Diócesis';
  end if;

  -- Asegurar que la partida existe y pertenece al ámbito declarado.
  if lower(p_sacrament_type) in ('bautismo','baptism') then
    if not exists(select 1 from public.baptisms where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Bautismo no encontrado'; end if;
  elsif lower(p_sacrament_type) in ('confirmacion','confirmation') then
    if not exists(select 1 from public.confirmations where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Confirmación no encontrada'; end if;
  elsif lower(p_sacrament_type) in ('matrimonio','marriage') then
    if not exists(select 1 from public.marriages where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Matrimonio no encontrado'; end if;
  elsif lower(p_sacrament_type) in ('exequias','funeral') then
    if not exists(select 1 from public.funerals where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Exequias no encontradas'; end if;
  elsif lower(p_sacrament_type) in ('primera_comunion','first_communion') then
    if not exists(select 1 from public.first_communions where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Primera Comunión no encontrada'; end if;
  else
    raise exception 'Tipo de registro no admitido';
  end if;

  insert into public.marginal_notes(
    sacrament_type,note_type,content,parish_id,sacrament_id,note_date,source_type,source_id,
    created_by,status,template_id,template_version,print_policy,print_default,is_locked,print_label,
    rendered_variables,clause_snapshot
  )
  select
    lower(p_sacrament_type),'manual',trim(p_content),p_parish_id,p_sacrament_id,coalesce(p_note_date,current_date),
    'manual',null,auth.uid(),'active',p_template_id,t.version,lower(p_print_policy),p_print_default,false,p_label,
    coalesce(p_variables,'{}'::jsonb),coalesce(p_clause_snapshot,'[]'::jsonb)
  from (select 1) x
  left join public.marginal_note_templates t on t.id=p_template_id
  returning id into v_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),p_parish_id,v_diocese,'marginal_note',v_id,'manual_note_created',
         jsonb_build_object('sacrament_type',p_sacrament_type,'sacrament_id',p_sacrament_id,'print_policy',p_print_policy,'content',p_content),
         jsonb_build_object('template_id',p_template_id));

  return v_id;
end;
$$;
revoke all on function public.create_manual_marginal_note(uuid,text,uuid,text,date,text,boolean,text,uuid,jsonb,jsonb) from public;
grant execute on function public.create_manual_marginal_note(uuid,text,uuid,text,date,text,boolean,text,uuid,jsonb,jsonb) to authenticated;

comment on table public.marginal_note_templates is 'Plantillas versionadas de notas marginales. Una plantilla define texto fijo, variables y política de impresión.';
comment on table public.marginal_note_template_clauses is 'Cláusulas fijas/opcionales combinables sobre una plantilla marginal.';
comment on column public.marginal_notes.print_policy is 'required: siempre imprime; optional: el usuario decide por impresión; internal: nunca se imprime en partida.';
