-- SACRAMENTUM · CONFIRMACIÓN · INTEGRIDAD BASE
-- Añade invariantes registrales sin modificar partidas existentes.
begin;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='ck_confirmations_birth_before_confirmation') then
    alter table public.confirmations
      add constraint ck_confirmations_birth_before_confirmation
      check (fecha_nacimiento is null or celebration_date is null or fecha_nacimiento <= celebration_date)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname='ck_confirmations_identity_complete') then
    alter table public.confirmations
      add constraint ck_confirmations_identity_complete
      check (
        celebration_date is not null
        and nullif(trim(coalesce(nombres,'')),'') is not null
        and nullif(trim(coalesce(apellidos,'')),'') is not null
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname='ck_confirmations_registry_ref_complete') then
    alter table public.confirmations
      add constraint ck_confirmations_registry_ref_complete
      check (        nullif(trim(coalesce(book_number,'')),'') is not null
        and nullif(trim(coalesce(folio,'')),'') is not null
        and nullif(trim(coalesce(number,'')),'') is not null
      ) not valid;
  end if;
end $$;

alter table public.confirmations validate constraint ck_confirmations_birth_before_confirmation;
alter table public.confirmations validate constraint ck_confirmations_identity_complete;
alter table public.confirmations validate constraint ck_confirmations_registry_ref_complete;

-- La unicidad física ya existe; el bloque la verifica expresamente.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='confirmations'
      and indexname='uq_confirmations_registry_number'
  ) then
    raise exception 'Falta el índice único uq_confirmations_registry_number';
  end if;
end $$;

commit;

select jsonb_build_object(
  'validated_constraints',(select count(*) from pg_constraint where conrelid='public.confirmations'::regclass and conname in ('ck_confirmations_birth_before_confirmation','ck_confirmations_identity_complete','ck_confirmations_registry_ref_complete') and convalidated),
  'unique_registry_index',exists(select 1 from pg_indexes where schemaname='public' and tablename='confirmations' and indexname='uq_confirmations_registry_number')
) as confirmation_integrity_postcheck;