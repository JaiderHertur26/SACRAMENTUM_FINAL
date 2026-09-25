-- ==========================================================================
-- SACRAMENTUM · Fase 2.15 · Integridad canónica adicional
-- Crea índices únicos únicamente cuando los datos actuales permiten hacerlo.
-- No elimina, fusiona ni modifica registros históricos conflictivos.
-- ==========================================================================

do $$
begin
  if not exists (
    select 1 from public.parish_parameters where parish_id is not null
    group by parish_id having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_parish_parameters_parish on public.parish_parameters(parish_id) where parish_id is not null';
  else
    raise notice 'SACRAMENTUM: parish_parameters tiene parroquias duplicadas; no se creó uq_parish_parameters_parish.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.sacrament_books
    where parish_id is not null and sacrament_type is not null and book_number is not null
    group by parish_id, lower(trim(sacrament_type)), book_number having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_sacrament_books_scope on public.sacrament_books(parish_id, lower(trim(sacrament_type)), book_number) where parish_id is not null';
  else
    raise notice 'SACRAMENTUM: sacrament_books contiene libros repetidos; no se creó uq_sacrament_books_scope.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.user_profiles where auth_user_id is not null
    group by auth_user_id having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_user_profiles_auth_user on public.user_profiles(auth_user_id) where auth_user_id is not null';
  else
    raise notice 'SACRAMENTUM: user_profiles contiene auth_user_id repetidos; no se creó uq_user_profiles_auth_user.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.pending_tokens where token is not null and trim(token) <> ''
    group by token having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_pending_tokens_token on public.pending_tokens(token) where token is not null and trim(token) <> ''''';
  else
    raise notice 'SACRAMENTUM: pending_tokens contiene tokens repetidos; no se creó uq_pending_tokens_token.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.decretos
    where diocese_id is not null and decree_number is not null and trim(decree_number) <> ''
    group by diocese_id, lower(trim(decree_number)) having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_decretos_diocese_number on public.decretos(diocese_id, lower(trim(decree_number))) where diocese_id is not null and decree_number is not null and trim(decree_number) <> ''''';
  else
    raise notice 'SACRAMENTUM: existen números de decreto repetidos dentro de una diócesis; no se creó uq_decretos_diocese_number.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.user_profiles
    where chancery_id is not null and lower(coalesce(role,''))='chancery' and coalesce(is_active,true)=true
    group by chancery_id having count(*) > 1
  ) then
    execute 'create unique index if not exists uq_active_chancery_user on public.user_profiles(chancery_id) where chancery_id is not null and lower(coalesce(role,''''))=''''chancery'''' and coalesce(is_active,true)=true';
  else
    raise notice 'SACRAMENTUM: existe más de un usuario Canciller activo para una Cancillería; no se creó uq_active_chancery_user.';
  end if;
end $$;
