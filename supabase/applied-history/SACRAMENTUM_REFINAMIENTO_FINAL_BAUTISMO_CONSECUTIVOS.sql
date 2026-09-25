begin;

create or replace function public.sacramentum_guard_baptism_parameter_monotonicity()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  oldp jsonb:=coalesce(old.bautizos_params,'{}'::jsonb);
  newp jsonb:=coalesce(new.bautizos_params,'{}'::jsonb);
  ob integer:=greatest(coalesce(nullif(oldp->>'ordinarioLibro','')::integer,1),1);
  ofo integer:=greatest(coalesce(nullif(oldp->>'ordinarioFolio','')::integer,1),1);
  ono integer:=greatest(coalesce(nullif(oldp->>'ordinarioNumero','')::integer,1),1);
  nb integer:=greatest(coalesce(nullif(newp->>'ordinarioLibro','')::integer,1),1);
  nfo integer:=greatest(coalesce(nullif(newp->>'ordinarioFolio','')::integer,1),1);
  nno integer:=greatest(coalesce(nullif(newp->>'ordinarioNumero','')::integer,1),1);
  osb integer:=greatest(coalesce(nullif(oldp->>'suplementarioLibro','')::integer,1),1);
  osf integer:=greatest(coalesce(nullif(oldp->>'suplementarioFolio','')::integer,1),1);
  osn integer:=greatest(coalesce(nullif(oldp->>'suplementarioNumero','')::integer,1),1);
  nsb integer:=greatest(coalesce(nullif(newp->>'suplementarioLibro','')::integer,1),1);
  nsf integer:=greatest(coalesce(nullif(newp->>'suplementarioFolio','')::integer,1),1);
  nsn integer:=greatest(coalesce(nullif(newp->>'suplementarioNumero','')::integer,1),1);
  oreg bigint:=coalesce(nullif(regexp_replace(coalesce(oldp->>'numeroRegistroActual',''),'[^0-9]','','g'),'')::bigint,0);
  nreg bigint:=coalesce(nullif(regexp_replace(coalesce(newp->>'numeroRegistroActual',''),'[^0-9]','','g'),'')::bigint,0);
begin  if new.bautizos_params is null then
    raise exception 'Los parámetros de Bautismo no pueden quedar vacíos';
  end if;

  if (nb,nfo,nno) < (ob,ofo,ono) then
    raise exception 'El consecutivo ordinario de Bautismo no puede retroceder de L %, F %, N % a L %, F %, N %',
      ob,ofo,ono,nb,nfo,nno;
  end if;

  if (nsb,nsf,nsn) < (osb,osf,osn) then
    raise exception 'El consecutivo supletorio de Bautismo no puede retroceder de L %, F %, N % a L %, F %, N %',
      osb,osf,osn,nsb,nsf,nsn;
  end if;

  if nreg < oreg then
    raise exception 'El Número de Registro de Bautismo no puede retroceder de % a %',
      lpad(oreg::text,6,'0'),lpad(nreg::text,6,'0');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_baptism_parameter_monotonicity on public.parish_parameters;
create trigger trg_guard_baptism_parameter_monotonicity
before update of bautizos_params on public.parish_parameters
for each row execute function public.sacramentum_guard_baptism_parameter_monotonicity();
revoke all on function public.sacramentum_guard_baptism_parameter_monotonicity() from public, anon, authenticated;

commit;