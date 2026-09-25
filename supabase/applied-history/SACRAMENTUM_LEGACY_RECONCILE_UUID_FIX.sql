do $$
declare v_ddl text;
begin
  select pg_get_functiondef('public.reconcile_legacy_pre_registrations_v2_internal(text)'::regprocedure)
    into v_ddl;
  v_ddl:=replace(v_ddl,'min(b.id)','(array_agg(b.id))[1]');
  v_ddl:=replace(v_ddl,'min(c.id)','(array_agg(c.id))[1]');
  if v_ddl not like '%array_agg(b.id)%' or v_ddl not like '%array_agg(c.id)%' then
    raise exception 'No se pudo parchear selección UUID de conciliación';
  end if;
  execute v_ddl;
end;
$$;
