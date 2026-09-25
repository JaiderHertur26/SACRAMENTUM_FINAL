-- SACRAMENTUM V24 · RLS & PERFORMANCE
-- 2026-09-25
-- Mantiene la misma autorización lógica y elimina evaluaciones redundantes.

begin;

-- ============================================================================
-- 1) BISHOP TENURES · separar lectura/escritura + initplan auth.uid()
-- ============================================================================
drop policy if exists "bishop_tenures_parish_select" on public.bishop_tenures;
drop policy if exists "bishop_tenures_parish_write" on public.bishop_tenures;

create policy "bishop_tenures_parish_select"
on public.bishop_tenures for select to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.auth_user_id = (select auth.uid())
      and coalesce(up.is_active,true)=true
      and (
        lower(up.role::text) in ('admin_general','diocese','archdiocese')
        or up.parish_id = bishop_tenures.parish_id
      )
  )
);

create policy "bishop_tenures_parish_insert"
on public.bishop_tenures for insert to authenticated
with check (
  exists (
    select 1 from public.user_profiles up
    where up.auth_user_id = (select auth.uid())
      and coalesce(up.is_active,true)=true
      and (
        lower(up.role::text) in ('admin_general','diocese','archdiocese')
        or up.parish_id = bishop_tenures.parish_id
      )
  )
);

create policy "bishop_tenures_parish_update"
on public.bishop_tenures for update to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.auth_user_id = (select auth.uid())
      and coalesce(up.is_active,true)=true
      and (
        lower(up.role::text) in ('admin_general','diocese','archdiocese')
        or up.parish_id = bishop_tenures.parish_id
      )
  )
)
with check (
  exists (
    select 1 from public.user_profiles up
    where up.auth_user_id = (select auth.uid())
      and coalesce(up.is_active,true)=true
      and (
        lower(up.role::text) in ('admin_general','diocese','archdiocese')
        or up.parish_id = bishop_tenures.parish_id
      )
  )
);

create policy "bishop_tenures_parish_delete"
on public.bishop_tenures for delete to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.auth_user_id = (select auth.uid())
      and coalesce(up.is_active,true)=true
      and (
        lower(up.role::text) in ('admin_general','diocese','archdiocese')
        or up.parish_id = bishop_tenures.parish_id
      )
  )
);

-- ============================================================================
-- 2) POLÍTICAS ALL -> INSERT / UPDATE / DELETE
-- Evita que la política de escritura se evalúe también en SELECT.
-- ============================================================================

-- ciudades
drop policy if exists "ciudades_write_owner" on public.ciudades;
create policy "ciudades_insert_owner" on public.ciudades for insert to authenticated
with check (public.is_app_admin() or (public.current_app_role()='parish' and context_id=public.current_app_parish_id()));
create policy "ciudades_update_owner" on public.ciudades for update to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and context_id=public.current_app_parish_id()))
with check (public.is_app_admin() or (public.current_app_role()='parish' and context_id=public.current_app_parish_id()));
create policy "ciudades_delete_owner" on public.ciudades for delete to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and context_id=public.current_app_parish_id()));

-- diocesis auxiliar
drop policy if exists "diocesis_aux_write_owner" on public.diocesis;
create policy "diocesis_aux_insert_owner" on public.diocesis for insert to authenticated
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "diocesis_aux_update_owner" on public.diocesis for update to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()))
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "diocesis_aux_delete_owner" on public.diocesis for delete to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));

-- iglesias
drop policy if exists "iglesias_write_owner" on public.iglesias;
create policy "iglesias_insert_owner" on public.iglesias for insert to authenticated
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "iglesias_update_owner" on public.iglesias for update to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()))
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "iglesias_delete_owner" on public.iglesias for delete to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));

-- mis_datos
drop policy if exists "mis_datos_write_owner" on public.mis_datos;
create policy "mis_datos_insert_owner" on public.mis_datos for insert to authenticated
with check (
  public.is_app_admin()
  or (public.current_app_role()='parish' and entity_id=public.current_app_parish_id())
  or (public.current_app_role()='diocese' and (entity_id=public.current_app_diocese_id() or public.can_access_parish(entity_id)))
);
create policy "mis_datos_update_owner" on public.mis_datos for update to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role()='parish' and entity_id=public.current_app_parish_id())
  or (public.current_app_role()='diocese' and (entity_id=public.current_app_diocese_id() or public.can_access_parish(entity_id)))
)
with check (
  public.is_app_admin()
  or (public.current_app_role()='parish' and entity_id=public.current_app_parish_id())
  or (public.current_app_role()='diocese' and (entity_id=public.current_app_diocese_id() or public.can_access_parish(entity_id)))
);
create policy "mis_datos_delete_owner" on public.mis_datos for delete to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role()='parish' and entity_id=public.current_app_parish_id())
  or (public.current_app_role()='diocese' and (entity_id=public.current_app_diocese_id() or public.can_access_parish(entity_id)))
);

-- obispos
drop policy if exists "obispos_write_owner" on public.obispos;
create policy "obispos_insert_owner" on public.obispos for insert to authenticated
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "obispos_update_owner" on public.obispos for update to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()))
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "obispos_delete_owner" on public.obispos for delete to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));

-- parish_parameters
drop policy if exists "parish_parameters_write_owner" on public.parish_parameters;
create policy "parish_parameters_insert_owner" on public.parish_parameters for insert to authenticated
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "parish_parameters_update_owner" on public.parish_parameters for update to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()))
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "parish_parameters_delete_owner" on public.parish_parameters for delete to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));

-- parrocos
drop policy if exists "parrocos_write_owner" on public.parrocos;
create policy "parrocos_insert_owner" on public.parrocos for insert to authenticated
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "parrocos_update_owner" on public.parrocos for update to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()))
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "parrocos_delete_owner" on public.parrocos for delete to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));

-- pending_baptisms
drop policy if exists "pending_baptisms_write_owner" on public.pending_baptisms;
create policy "pending_baptisms_insert_owner" on public.pending_baptisms for insert to authenticated
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "pending_baptisms_update_owner" on public.pending_baptisms for update to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()))
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "pending_baptisms_delete_owner" on public.pending_baptisms for delete to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));

-- pending_confirmations
drop policy if exists "pending_confirmations_write_owner" on public.pending_confirmations;
create policy "pending_confirmations_insert_owner" on public.pending_confirmations for insert to authenticated
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "pending_confirmations_update_owner" on public.pending_confirmations for update to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()))
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "pending_confirmations_delete_owner" on public.pending_confirmations for delete to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));

-- sacrament_books
drop policy if exists "sacrament_books_write_owner" on public.sacrament_books;
create policy "sacrament_books_insert_owner" on public.sacrament_books for insert to authenticated
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "sacrament_books_update_owner" on public.sacrament_books for update to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()))
with check (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));
create policy "sacrament_books_delete_owner" on public.sacrament_books for delete to authenticated
using (public.is_app_admin() or (public.current_app_role()='parish' and parish_id=public.current_app_parish_id()));

-- ============================================================================
-- 3) auth.uid() como initplan: evaluación una vez por consulta
-- ============================================================================
drop policy if exists "pending_tokens_select_owner" on public.pending_tokens;
create policy "pending_tokens_select_owner"
on public.pending_tokens for select to authenticated
using (public.is_app_admin() or created_by=(select auth.uid()));

drop policy if exists "pending_tokens_insert_owner" on public.pending_tokens;
create policy "pending_tokens_insert_owner"
on public.pending_tokens for insert to authenticated
with check (
  (
    public.is_app_admin()
    and created_by=(select auth.uid())
    and upper(type::text)='DIOCESE'
  )
  or (
    public.current_app_role()='diocese'
    and created_by=(select auth.uid())
    and upper(type::text) in ('PARISH','CHANCERY')
    and coalesce(payload->>'dioceseId','')=coalesce(public.current_effective_diocese_id()::text,'')
    and (
      upper(type::text)='CHANCERY'
      or (
        coalesce(payload->>'vicaryId','')<>''
        and coalesce(payload->>'decanateId','')<>''
      )
    )
  )
);

drop policy if exists "pending_tokens_delete_owner" on public.pending_tokens;
create policy "pending_tokens_delete_owner"
on public.pending_tokens for delete to authenticated
using (
  public.is_app_admin()
  or (public.current_app_role()='diocese' and created_by=(select auth.uid()))
);

drop policy if exists "profiles_select_scoped" on public.user_profiles;
create policy "profiles_select_scoped"
on public.user_profiles for select to authenticated
using (
  auth_user_id=(select auth.uid())
  or public.is_app_admin()
  or (public.current_app_role()='diocese' and diocese_id=public.current_app_diocese_id())
  or (public.current_app_role()='chancery' and diocese_id=public.current_app_diocese_id())
);

-- ============================================================================
-- 4) ÍNDICES FK DE ALTO USO
-- ============================================================================
create index if not exists idx_v24_baptisms_book_id on public.baptisms(book_id);
create index if not exists idx_v24_baptisms_linked_funeral_id on public.baptisms(linked_funeral_id);
create index if not exists idx_v24_baptisms_parishioner_id on public.baptisms(parishioner_id);

create index if not exists idx_v24_confirmations_book_id on public.confirmations(book_id);
create index if not exists idx_v24_confirmations_parishioner_id on public.confirmations(parishioner_id);

create index if not exists idx_v24_funerals_book_id on public.funerals(book_id);
create index if not exists idx_v24_funerals_parishioner_id on public.funerals(parishioner_id);

create index if not exists idx_v24_marriages_book_id on public.marriages(book_id);
create index if not exists idx_v24_marriages_husband_id on public.marriages(husband_id);
create index if not exists idx_v24_marriages_wife_id on public.marriages(wife_id);

create index if not exists idx_v24_bishop_tenures_bishop_id on public.bishop_tenures(bishop_id);
create index if not exists idx_v24_decanatos_vicaria_id on public.decanatos(vicaria_id);

create index if not exists idx_v24_document_templates_diocese_id on public.document_templates(diocese_id);
create index if not exists idx_v24_document_templates_parish_id on public.document_templates(parish_id);

create index if not exists idx_v24_marginal_note_templates_diocese_id on public.marginal_note_templates(diocese_id);
create index if not exists idx_v24_marginal_note_templates_parish_id on public.marginal_note_templates(parish_id);
create index if not exists idx_v24_marginal_notes_parish_id on public.marginal_notes(parish_id);
create index if not exists idx_v24_marginal_notes_template_id on public.marginal_notes(template_id);

create index if not exists idx_v24_matrimonial_recipients_target_baptism_id
  on public.matrimonial_notification_recipients(target_baptism_id);
create index if not exists idx_v24_matrimonial_notifications_diocese_id
  on public.matrimonial_notifications(diocese_id);
create index if not exists idx_v24_matrimonial_notifications_marriage_diocese_id
  on public.matrimonial_notifications(marriage_diocese_id);
create index if not exists idx_v24_matrimonial_notifications_marriage_parish_id
  on public.matrimonial_notifications(marriage_parish_id);
create index if not exists idx_v24_matrimonial_notifications_source_baptism_id
  on public.matrimonial_notifications(source_baptism_id);
create index if not exists idx_v24_matrimonial_notifications_spouse_baptism_id
  on public.matrimonial_notifications(spouse_baptism_id);

create index if not exists idx_v24_official_notifications_diocese_id
  on public.official_notifications(diocese_id);
create index if not exists idx_v24_official_notifications_sender_chancery_id
  on public.official_notifications(sender_chancery_id);

create index if not exists idx_v24_parishes_deanery_id on public.parishes(deanery_id);
create index if not exists idx_v24_parishes_decanate_id on public.parishes(decanate_id);
create index if not exists idx_v24_parishes_vicary_id on public.parishes(vicary_id);

create index if not exists idx_v24_pending_baptisms_parish_id on public.pending_baptisms(parish_id);
create index if not exists idx_v24_pending_confirmations_parish_id on public.pending_confirmations(parish_id);
create index if not exists idx_v24_pending_funerals_baptism_id on public.pending_funerals(baptism_id);

create index if not exists idx_v24_user_profiles_diocese_id on public.user_profiles(diocese_id);
create index if not exists idx_v24_user_profiles_parish_id on public.user_profiles(parish_id);

create index if not exists idx_v24_chat_messages_reply_to_id on public.chat_messages(reply_to_id);
create index if not exists idx_v24_chat_messages_sender_profile_id on public.chat_messages(sender_profile_id);
create index if not exists idx_v24_chat_room_members_last_read_message_id on public.chat_room_members(last_read_message_id);

notify pgrst, 'reload schema';
commit;
