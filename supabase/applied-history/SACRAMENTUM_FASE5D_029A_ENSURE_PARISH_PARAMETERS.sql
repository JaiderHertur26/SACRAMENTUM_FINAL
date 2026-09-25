-- SACRAMENTUM · FASE 5D · HOTFIX 029A
-- COMPATIBILIDAD: public.ensure_parish_parameters(uuid)
-- Fecha: 2026-09-13
--
-- Motivo:
-- Las RPC Cloud-Native de Exequias llaman internamente a
-- public.ensure_parish_parameters(uuid), pero esa función auxiliar
-- no existe en esta instalación.
--
-- Este hotfix:
-- 1) crea únicamente la función auxiliar faltante;
-- 2) NO altera funerals ni pending_funerals;
-- 3) NO consume consecutivos;
-- 4) NO crea registros de Exequias;
-- 5) si la parroquia ya tiene parish_parameters, no cambia sus valores.

begin;

create or replace function public.ensure_parish_parameters(
  p_parish_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if p_parish_id is null then
    raise exception 'La parroquia es obligatoria';
  end if;

  -- Caso normal: la fila ya existe. No modifica ningún parámetro.
  select pp.id
    into v_id
  from public.parish_parameters pp
  where pp.parish_id = p_parish_id
  order by pp.created_at nulls last
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  -- Inicialización mínima para una parroquia nueva.
  -- Los demás módulos pueden completar posteriormente sus propios JSON.
  insert into public.parish_parameters(
    parish_id,
    exequias_params
  )
  values(
    p_parish_id,
    public.sacramentum_default_funeral_params()
  )
  returning id into v_id;

  return v_id;
end;
$function$;

-- Helper interno: no se expone al navegador.
revoke execute on function public.ensure_parish_parameters(uuid) from public;
revoke execute on function public.ensure_parish_parameters(uuid) from anon;
revoke execute on function public.ensure_parish_parameters(uuid) from authenticated;

grant execute on function public.ensure_parish_parameters(uuid) to service_role;

commit;

-- POST-CHECK SOLO LECTURA
select jsonb_pretty(
  jsonb_build_object(
    'ensure_parish_parameters_ok',
      to_regprocedure('public.ensure_parish_parameters(uuid)') is not null,
    'security_definer',
      coalesce((
        select p.prosecdef
        from pg_proc p
        where p.oid = to_regprocedure('public.ensure_parish_parameters(uuid)')
      ), false),
    'anon_execute',
      has_function_privilege(
        'anon',
        'public.ensure_parish_parameters(uuid)',
        'EXECUTE'
      ),
    'authenticated_execute',
      has_function_privilege(
        'authenticated',
        'public.ensure_parish_parameters(uuid)',
        'EXECUTE'
      ),
    'service_role_execute',
      has_function_privilege(
        'service_role',
        'public.ensure_parish_parameters(uuid)',
        'EXECUTE'
      )
  )
) as fase5d_029a_postcheck;
