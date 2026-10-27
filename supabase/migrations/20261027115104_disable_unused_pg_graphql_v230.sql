-- V230: SACRAMENTUM uses Supabase REST/RPC with RLS; no GraphQL API in src/.
-- Disable the unused pg_graphql extension and remove the redundant GraphQL Query/Mutation
-- surface. Supabase maintains graphql_public.graphql() as a disabled placeholder.
-- This migration has no DML, does not modify sacramental records or Auth accounts,
-- and keeps PostgREST, RLS and institutional RPCs intact.
DROP EXTENSION IF EXISTS pg_graphql RESTRICT;
DO $v230$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_graphql') THEN
    RAISE EXCEPTION 'V230: pg_graphql remained enabled';
  END IF;
END
$v230$;
