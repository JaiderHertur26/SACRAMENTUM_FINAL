-- SACRAMENTUM V55 · Buscador de antecedentes para emisión documental
create or replace function public.search_document_context(
  p_term text,
  p_limit integer default 30
)
returns table(
  source_type text,
  entity_id uuid,
  display_name text,
  reference text,
  context jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_parish uuid;
  v_diocese uuid;
  v_term text := trim(coalesce(p_term,''));
  v_limit integer := greatest(1,least(coalesce(p_limit,30),100));
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if length(v_term) < 2 then raise exception 'Digite al menos dos caracteres'; end if;

  select lower(coalesce(role,'')),parish_id,diocese_id
    into v_role,v_parish,v_diocese
  from public.user_profiles
  where auth_user_id=auth.uid()
    and coalesce(is_active,true)=true
    and coalesce(lower(status),'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role not in ('parish','diocese','chancery','admin_general') then
    raise exception 'Rol no autorizado';
  end if;

  return query
  with scope_parishes as (
    select p.id
    from public.parishes p
    where v_role='admin_general'
       or (v_role='parish' and p.id=v_parish)
       or (v_role in ('diocese','chancery') and p.diocese_id=v_diocese)
  ),
  current_rows as (
    select
      'baptism'::text source_type,
      b.id entity_id,
      trim(concat_ws(' ',b.nombres,b.apellidos)) display_name,
      concat_ws(' · ',
        nullif('Bautismo',''),
        nullif('L '||coalesce(b.book_number,''),'L '),
        nullif('F '||coalesce(b.folio,''),'F '),
        nullif('N '||coalesce(b.number,''),'N ')
      ) reference,
      jsonb_build_object(
        'entity_type','baptism','id',b.id,'Nombres',coalesce(b.nombres,''),
        'Apellidos',coalesce(b.apellidos,''),'Nombre',trim(concat_ws(' ',b.nombres,b.apellidos)),
        'Libro',coalesce(b.book_number,''),'Folio',coalesce(b.folio,''),'Numero',coalesce(b.number,''),
        'FechaBautismo',coalesce(b.celebration_date::text,''),'FechaNacimiento',coalesce(b.fecha_nacimiento::text,''),
        'LugarNacimiento',coalesce(b.lugar_nacimiento,''),'LugarBautismo',coalesce(b.lugar_bautismo,''),
        'Sexo',coalesce(b.sexo,''),'Padre',coalesce(b.nombre_padre,''),'Madre',coalesce(b.nombre_madre,''),
        'Padres',trim(concat_ws(' y ',nullif(b.nombre_padre,''),nullif(b.nombre_madre,''))),
        'Ministro',coalesce(b.ministro,''),'DaFe',coalesce(b.da_fe,'')
      ) context
    from public.baptisms b
    where b.parish_id in(select id from scope_parishes)
      and lower(coalesce(b.status,'seated')) not in ('anulada','anulado','annulled','reverted','cancelled','deleted')
      and (
        trim(concat_ws(' ',b.nombres,b.apellidos)) ilike '%'||v_term||'%'
        or coalesce(b.book_number,'') ilike '%'||v_term||'%'
        or coalesce(b.number,'') ilike '%'||v_term||'%'
      )

    union all

    select
      'confirmation',c.id,
      trim(concat_ws(' ',c.nombres,c.apellidos)),
      concat_ws(' · ','Confirmación',
        nullif('L '||coalesce(c.book_number,''),'L '),
        nullif('F '||coalesce(c.folio,''),'F '),
        nullif('N '||coalesce(c.number,''),'N ')
      ),
      jsonb_build_object(
        'entity_type','confirmation','id',c.id,'Nombres',coalesce(c.nombres,''),
        'Apellidos',coalesce(c.apellidos,''),'Nombre',trim(concat_ws(' ',c.nombres,c.apellidos)),
        'Libro',coalesce(c.book_number,''),'Folio',coalesce(c.folio,''),'Numero',coalesce(c.number,''),
        'FechaConfirmacion',coalesce(c.celebration_date::text,''),'FechaNacimiento',coalesce(c.fecha_nacimiento::text,''),
        'FechaBautismo',coalesce(c.fecha_bautismo::text,''),'LugarNacimiento',coalesce(c.lugar_nacimiento,''),
        'LugarBautismo',coalesce(c.lugar_bautismo,''),'Sexo',coalesce(c.sexo,''),
        'Padre',coalesce(c.nombre_padre,''),'Madre',coalesce(c.nombre_madre,''),
        'Padres',trim(concat_ws(' y ',nullif(c.nombre_padre,''),nullif(c.nombre_madre,''))),
        'Padrinos',coalesce(c.padrinos,''),'Ministro',coalesce(c.ministro,''),'DaFe',coalesce(c.da_fe,'')
      )
    from public.confirmations c
    where c.parish_id in(select id from scope_parishes)
      and lower(coalesce(c.status,'seated')) not in ('anulada','anulado','annulled','reverted','cancelled','deleted')
      and (
        trim(concat_ws(' ',c.nombres,c.apellidos)) ilike '%'||v_term||'%'
        or coalesce(c.book_number,'') ilike '%'||v_term||'%'
        or coalesce(c.number,'') ilike '%'||v_term||'%'
      )
    union all

    select
      'marriage',m.id,
      trim(concat_ws(' + ',
        nullif(trim(concat_ws(' ',m.raw_data->>'novioNombres',m.raw_data->>'novioApellidos')),''),
        nullif(trim(concat_ws(' ',m.raw_data->>'noviaNombres',m.raw_data->>'noviaApellidos')),'')
      )),
      concat_ws(' · ','Matrimonio',
        nullif('L '||coalesce(m.book_number,''),'L '),
        nullif('F '||coalesce(m.folio,''),'F '),
        nullif('N '||coalesce(m.number,''),'N ')
      ),
      jsonb_build_object(
        'entity_type','marriage','id',m.id,
        'Novio',trim(concat_ws(' ',m.raw_data->>'novioNombres',m.raw_data->>'novioApellidos')),
        'Novia',trim(concat_ws(' ',m.raw_data->>'noviaNombres',m.raw_data->>'noviaApellidos')),
        'ElContrayente',trim(concat_ws(' ',m.raw_data->>'novioNombres',m.raw_data->>'novioApellidos')),
        'LaContrayente',trim(concat_ws(' ',m.raw_data->>'noviaNombres',m.raw_data->>'noviaApellidos')),
        'Libro',coalesce(m.book_number,''),'Folio',coalesce(m.folio,''),'Numero',coalesce(m.number,''),
        'FechaMatrimonio',coalesce(m.celebration_date::text,''),
        'Ministro',coalesce(m.raw_data->>'ministro',''),
        'Testigos',coalesce(m.raw_data->>'testigos','')
      )
    from public.marriages m
    where m.parish_id in(select id from scope_parishes)
      and lower(coalesce(m.status,'seated')) not in ('anulada','anulado','annulled','reverted','cancelled','deleted')
      and (
        coalesce(m.raw_data->>'novioNombres','') ilike '%'||v_term||'%'
        or coalesce(m.raw_data->>'novioApellidos','') ilike '%'||v_term||'%'
        or coalesce(m.raw_data->>'noviaNombres','') ilike '%'||v_term||'%'
        or coalesce(m.raw_data->>'noviaApellidos','') ilike '%'||v_term||'%'
        or coalesce(m.book_number,'') ilike '%'||v_term||'%'
        or coalesce(m.number,'') ilike '%'||v_term||'%'
      )

    union all

    select
      'funeral',f.id,
      trim(concat_ws(' ',f.nombres,f.apellidos)),
      concat_ws(' · ','Exequias',
        nullif('L '||coalesce(f.book_number,''),'L '),
        nullif('F '||coalesce(f.folio,''),'F '),
        nullif('N '||coalesce(f.number,''),'N ')
      ),
      jsonb_build_object(
        'entity_type','funeral','id',f.id,'Nombres',coalesce(f.nombres,''),
        'Apellidos',coalesce(f.apellidos,''),'Nombre',trim(concat_ws(' ',f.nombres,f.apellidos)),
        'Libro',coalesce(f.book_number,''),'Folio',coalesce(f.folio,''),'Numero',coalesce(f.number,''),
        'Fechae',coalesce(f.fecha_exequias::text,''),'Fecham',coalesce(f.fecha_defuncion::text,''),
        'FechaNacimiento',coalesce(f.fecha_nacimiento::text,''),'LugarNacimiento',coalesce(f.lugar_nacimiento,''),
        'Sexo',coalesce(f.sexo,''),'Padre',coalesce(f.nombre_padre,''),'Madre',coalesce(f.nombre_madre,''),
        'Padres',trim(concat_ws(' y ',nullif(f.nombre_padre,''),nullif(f.nombre_madre,''))),
        'Ministro',coalesce(f.ministro,''),'DaFe',coalesce(f.da_fe,'')
      )
    from public.funerals f
    where f.parish_id in(select id from scope_parishes)
      and lower(coalesce(f.status,'seated')) not in ('anulada','anulado','annulled','reverted','cancelled','deleted')
      and (
        trim(concat_ws(' ',f.nombres,f.apellidos)) ilike '%'||v_term||'%'
        or coalesce(f.book_number,'') ilike '%'||v_term||'%'
        or coalesce(f.number,'') ilike '%'||v_term||'%'
      )
  ),
  legacy_rows as (
    select
      'legacy:'||lower(coalesce(l.profile_key,'archive')) source_type,
      l.id entity_id,
      coalesce(
        nullif(trim(concat_ws(' ',
          l.normalized_data->>'names',
          l.normalized_data->>'last_names'
        )),''),
        nullif(trim(concat_ws(' ',
          l.original_data->>'nombres',
          l.original_data->>'apellidos'
        )),''),
        l.source_key
      ) display_name,
      concat_ws(' · ',
        coalesce(l.profile_key,'LEGACY'),
        nullif('L '||coalesce(l.normalized_data->>'book_number',l.original_data->>'libro',''),'L '),
        nullif('F '||coalesce(l.normalized_data->>'folio',l.original_data->>'folio',''),'F '),
        nullif('N '||coalesce(l.normalized_data->>'number',l.original_data->>'numero',''),'N ')
      ) reference,
      coalesce(l.normalized_data,'{}'::jsonb)
        || jsonb_build_object(
          'entity_type','legacy_archive',
          'id',l.id,
          'legacy_profile',l.profile_key,
          'legacy_source_key',l.source_key,
          'Nombres',coalesce(l.normalized_data->>'names',l.original_data->>'nombres',''),
          'Apellidos',coalesce(l.normalized_data->>'last_names',l.original_data->>'apellidos',''),
          'Nombre',trim(concat_ws(' ',
            coalesce(l.normalized_data->>'names',l.original_data->>'nombres',''),
            coalesce(l.normalized_data->>'last_names',l.original_data->>'apellidos','')
          )),
          'Libro',coalesce(l.normalized_data->>'book_number',l.original_data->>'libro',''),
          'Folio',coalesce(l.normalized_data->>'folio',l.original_data->>'folio',''),
          'Numero',coalesce(l.normalized_data->>'number',l.original_data->>'numero','')
        ) context
    from public.legacy_archive_records l
    where (
      v_role='admin_general'
      or (v_role='parish' and l.parish_id=v_parish)
      or (v_role in ('diocese','chancery') and l.diocese_id=v_diocese)
    )
      and (
        coalesce(l.normalized_data::text,'') ilike '%'||v_term||'%'
        or coalesce(l.original_data::text,'') ilike '%'||v_term||'%'
        or coalesce(l.source_key,'') ilike '%'||v_term||'%'
      )
  )
  select r.source_type,r.entity_id,r.display_name,r.reference,r.context
  from (
    select * from current_rows
    union all
    select * from legacy_rows
  ) r
  order by
    case when r.source_type like 'legacy:%' then 1 else 0 end,
    r.display_name
  limit v_limit;
end;
$$;

revoke all on function public.search_document_context(text,integer) from public;
revoke all on function public.search_document_context(text,integer) from anon;
grant execute on function public.search_document_context(text,integer) to authenticated;

comment on function public.search_document_context(text,integer)
is 'Busca antecedentes actuales y legacy para autocompletar documentos sin alterar la fuente histórica.';
