begin;

revoke all on function public.sacramentum_legacy_code(text) from public, anon, authenticated;
revoke all on function public.sacramentum_legacy_sex_label(text) from public, anon, authenticated;
revoke all on function public.sacramentum_legacy_union_label(text) from public, anon, authenticated;
revoke all on function public.sacramentum_resolve_legacy_priest_name(uuid,text) from public, anon, authenticated;
revoke all on function public.sacramentum_legacy_priest_display(uuid,text) from public, anon, authenticated;
revoke all on function public.sacramentum_enrich_legacy_raw_data(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.sacramentum_normalize_legacy_record_before_write() from public, anon, authenticated;
revoke all on function public.sacramentum_refresh_legacy_reference_labels(uuid) from public, anon, authenticated;
revoke all on function public.sacramentum_refresh_legacy_reference_labels_on_priest_change() from public, anon, authenticated;

commit;
