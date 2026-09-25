begin;

alter function public.sacramentum_legacy_code(text)
  set search_path = public, pg_temp;
alter function public.sacramentum_legacy_sex_label(text)
  set search_path = public, pg_temp;
alter function public.sacramentum_legacy_union_label(text)
  set search_path = public, pg_temp;

revoke all on function public.sacramentum_legacy_code(text) from public, anon, authenticated;
revoke all on function public.sacramentum_legacy_sex_label(text) from public, anon, authenticated;
revoke all on function public.sacramentum_legacy_union_label(text) from public, anon, authenticated;

commit;
