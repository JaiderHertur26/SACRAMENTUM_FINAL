-- SACRAMENTUM V18 · VISIBILIDAD SEGURA DE DATOS AUXILIARES
begin;

-- Ningún catálogo auxiliar se expone al rol anon.
revoke all on table public.parrocos,public.iglesias,public.ciudades,public.obispos,public.diocesis,public.mis_datos from anon;

grant select,insert,update,delete on table
  public.parrocos,public.iglesias,public.ciudades,public.obispos,public.diocesis,public.mis_datos
to authenticated;

-- ---------------------------------------------------------------------------
-- PÁRROCOS
-- ---------------------------------------------------------------------------
drop policy if exists parrocos_select_scoped on public.parrocos;
drop policy if exists parrocos_write_owner on public.parrocos;

create policy parrocos_select_scoped on public.parrocos
for select to authenticated
using (
  parish_id is not null
  and public.can_access_parish(parish_id)
);

create policy parrocos_write_owner on public.parrocos
for all to authenticated
using (
  public.is_app_admin()
  or (
    public.current_app_role()='parish'
    and parish_id=public.current_app_parish_id()
  )
)
with check (
  public.is_app_admin()
  or (
    public.current_app_role()='parish'
    and parish_id=public.current_app_parish_id()
  )
);

-- ---------------------------------------------------------------------------
-- IGLESIAS
-- ---------------------------------------------------------------------------
drop policy if exists iglesias_select_scoped on public.iglesias;
drop policy if exists iglesias_write_owner on public.iglesias;

create policy iglesias_select_scoped on public.iglesias
for select to authenticated
using (
  parish_id is not null
  and public.can_access_parish(parish_id)
);

create policy iglesias_write_owner on public.iglesias
for all to authenticated
using (
  public.is_app_admin()
  or (
    public.current_app_role()='parish'
    and parish_id=public.current_app_parish_id()
  )
)
with check (
  public.is_app_admin()
  or (
    public.current_app_role()='parish'
    and parish_id=public.current_app_parish_id()
  )
);

-- ---------------------------------------------------------------------------
-- OBISPOS / MINISTROS
-- ---------------------------------------------------------------------------
drop policy if exists obispos_select_scoped on public.obispos;
drop policy if exists obispos_write_owner on public.obispos;

create policy obispos_select_scoped on public.obispos
for select to authenticated
using (
  parish_id is not null
  and public.can_access_parish(parish_id)
);

create policy obispos_write_owner on public.obispos
for all to authenticated
using (
  public.is_app_admin()
  or (
    public.current_app_role()='parish'
    and parish_id=public.current_app_parish_id()
  )
)
with check (
  public.is_app_admin()
  or (
    public.current_app_role()='parish'
    and parish_id=public.current_app_parish_id()
  )
);

-- ---------------------------------------------------------------------------
-- DIÓCESIS AUXILIARES
-- ---------------------------------------------------------------------------
drop policy if exists diocesis_aux_select_scoped on public.diocesis;
drop policy if exists diocesis_aux_write_owner on public.diocesis;

create policy diocesis_aux_select_scoped on public.diocesis
for select to authenticated
using (
  parish_id is not null
  and public.can_access_parish(parish_id)
);

create policy diocesis_aux_write_owner on public.diocesis
for all to authenticated
using (
  public.is_app_admin()
  or (
    public.current_app_role()='parish'
    and parish_id=public.current_app_parish_id()
  )
)
with check (
  public.is_app_admin()
  or (
    public.current_app_role()='parish'
    and parish_id=public.current_app_parish_id()
  )
);

-- ---------------------------------------------------------------------------
-- CIUDADES: context_id es la parroquia propietaria.
-- ---------------------------------------------------------------------------
drop policy if exists ciudades_select_scoped on public.ciudades;
drop policy if exists ciudades_write_owner on public.ciudades;

create policy ciudades_select_scoped on public.ciudades
for select to authenticated
using (
  context_id is not null
  and public.can_access_parish(context_id)
);

create policy ciudades_write_owner on public.ciudades
for all to authenticated
using (
  public.is_app_admin()
  or (
    public.current_app_role()='parish'
    and context_id=public.current_app_parish_id()
  )
)
with check (
  public.is_app_admin()
  or (
    public.current_app_role()='parish'
    and context_id=public.current_app_parish_id()
  )
);

-- ---------------------------------------------------------------------------
-- MIS DATOS: entity_id puede ser parroquia o diócesis.
-- ---------------------------------------------------------------------------
drop policy if exists mis_datos_select_scoped on public.mis_datos;
drop policy if exists mis_datos_write_owner on public.mis_datos;

create policy mis_datos_select_scoped on public.mis_datos
for select to authenticated
using (
  public.is_app_admin()
  or (
    public.current_app_role()='parish'
    and entity_id=public.current_app_parish_id()
  )
  or (
    public.current_app_role() in ('diocese','chancery')
    and (
      entity_id=public.current_app_diocese_id()
      or public.can_access_parish(entity_id)
    )
  )
);

create policy mis_datos_write_owner on public.mis_datos
for all to authenticated
using (
  public.is_app_admin()
  or (
    public.current_app_role()='parish'
    and entity_id=public.current_app_parish_id()
  )
  or (
    public.current_app_role()='diocese'
    and (
      entity_id=public.current_app_diocese_id()
      or public.can_access_parish(entity_id)
    )
  )
)
with check (
  public.is_app_admin()
  or (
    public.current_app_role()='parish'
    and entity_id=public.current_app_parish_id()
  )
  or (
    public.current_app_role()='diocese'
    and (
      entity_id=public.current_app_diocese_id()
      or public.can_access_parish(entity_id)
    )
  )
);

commit;