select jsonb_build_array(
  public.materialize_auxiliary_catalog_batch('1d800c46-6cb0-4d69-8ff3-a4b6e706b72d'::uuid),
  public.materialize_auxiliary_catalog_batch('6f220c12-e628-4ffd-b75c-e1bd54378650'::uuid)
) as materialization;