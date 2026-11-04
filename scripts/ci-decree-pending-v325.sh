#!/usr/bin/env bash
set -euo pipefail
: "${PG_CONTAINER:?PostgreSQL aislado requerido}"
database=decree_pending_v325
docker exec "$PG_CONTAINER" createdb -U postgres "$database"
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < scripts/fixture-decree-pending-v325.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < supabase/deployment/20261102012113_isolate_decree_pending_seats_v325.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < scripts/qa-decree-pending-v325.sql
