#!/usr/bin/env bash
set -euo pipefail
: "${PG_CONTAINER:?PostgreSQL aislado requerido}"
database=auxiliary_v323
docker exec "$PG_CONTAINER" createdb -U postgres "$database"
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < scripts/fixture-diocesan-auxiliaries-v323.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < supabase/deployment/20261101190320_shared_diocesan_auxiliary_catalogs_v323.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < scripts/qa-rollback-diocesan-auxiliaries-v323.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < scripts/qa-isolated-shared-imports-v323.sql
