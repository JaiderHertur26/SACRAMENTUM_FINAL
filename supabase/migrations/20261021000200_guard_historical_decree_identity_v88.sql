-- V88 · No permitir que la conciliación de ANULACION.DBF reutilice un decreto
-- perteneciente a otra parroquia o altere vínculos de una emisión actual.
-- El reconciliador V86 sigue procesando lotes; las colisiones se marcan como
-- error de importación para revisión, sin modificar el decreto preexistente.
create or replace function private.guard_legacy_decree_identity_v88()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_source text := coalesce(new.payload->>'source','');
  v_old_source text;
begin
  if v_source <> 'ANULACION.DBF' then
    return new;
  end if;

  if new.decree_number is null or btrim(new.decree_number) = '' then
    raise exception 'La corrección histórica necesita un número de decreto verificable';
  end if;
  if new.original_record_id is null or new.replacement_record_id is null
     or new.original_record_id = new.replacement_record_id then
    raise exception 'Corrección histórica con relación original / nueva incompleta o inválida';
  end if;

  if tg_op = 'UPDATE' then
    v_old_source := coalesce(old.payload->>'source','');
    if v_old_source not in ('ANULACION.DBF','legacy_reconciliation_v68') then
      raise exception 'El número pertenece a un decreto no originado en ANULACION.DBF; requiere revisión';
    end if;
    if old.diocese_id is distinct from new.diocese_id
       or old.parish_id is distinct from new.parish_id then
      raise exception 'Colisión entre parroquias al reconciliar el decreto histórico';
    end if;
    if old.original_record_id is not null and old.original_record_id <> new.original_record_id then
      raise exception 'El decreto histórico ya está vinculado a otra partida original';
    end if;
    if old.replacement_record_id is not null and old.replacement_record_id <> new.replacement_record_id then
      raise exception 'El decreto histórico ya está vinculado a otra partida supletoria';
    end if;
    if lower(btrim(coalesce(old.decree_number,''))) is distinct from lower(btrim(new.decree_number)) then
      raise exception 'No se puede cambiar el número de un decreto histórico conciliado';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_legacy_decree_identity_v88() from public,anon,authenticated;

drop trigger if exists trg_guard_legacy_decree_identity_v88 on public.decretos;
create trigger trg_guard_legacy_decree_identity_v88
before insert or update on public.decretos
for each row
execute function private.guard_legacy_decree_identity_v88();

comment on function private.guard_legacy_decree_identity_v88() is
'V88: bloquea colisiones por número, cambio de parroquia y sustitución de pares de partidas por el reconciliador ANULACION.DBF.';
