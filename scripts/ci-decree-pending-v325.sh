#!/usr/bin/env bash
set -euo pipefail
: "${PG_CONTAINER:?PostgreSQL aislado requerido}"
database=decree_pending_v325
docker exec "$PG_CONTAINER" createdb -U postgres "$database"
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < scripts/fixture-decree-pending-v325.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < supabase/deployment/20261102012113_isolate_decree_pending_seats_v325.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < scripts/fixture-celebration-support-v326.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < supabase/deployment/20261114114217_validate_sacramental_celebration_v326.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < scripts/qa-celebration-dates-v326.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < supabase/deployment/20261114134302_require_manual_ordinary_seating_v328.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < supabase/deployment/20261114134304_reconcile_occupied_ordinary_positions_v328.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < scripts/qa-manual-ordinary-first-book-v328.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < scripts/qa-decree-pending-v325.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < supabase/deployment/20261114134305_restrict_automatic_ordinary_seating_v328.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < scripts/qa-manual-ordinary-seat-v328.sql
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < scripts/qa-manual-ordinary-collision-v328.sql

# Continúa con el circuito completo de libro ordinario y supletorio en la misma base ficticia.
for file in \
  supabase/migrations/20260904000900_009_historical_registry_imports.sql \
  scripts/fixtures/book_sequence_v330.sql \
  supabase/applied-history/SACRAMENTUM_BAUTISMO_DIGITALIZACION_HISTORICA_INMUTABLE.sql \
  supabase/applied-history/SACRAMENTUM_CONFIRMACION_HISTORICA_INMUTABLE.sql \
  supabase/migrations/20260926003035_narrative_historical_entries_v31.sql \
  supabase/migrations/20261028203353_sacramentum_v252_private_book_ledger_staged.sql \
  scripts/qa-v253-ledger-transactions.sql \
  supabase/migrations/20261028203436_sacramentum_v263_four_sacrament_rpcs_private_staged.sql \
  scripts/v281-repair-real-ledger-kernel.sql \
  supabase/migrations/20261029001737_sacramentum_v280_issue_decree_without_book_coordinates.sql \
  supabase/migrations/20261029001740_sacramentum_v280_parish_seat_strict_order_and_chancery_receipt.sql \
  supabase/migrations/20261029001838_sacramentum_v280b_screen_context_decree_parish_and_chancery.sql \
  scripts/v287-issue-from-full-legacy-form-without-coordinates.sql \
  supabase/migrations/20261029034915_sacramentum_v293_chancery_role_authorized_no_diocese_concept_gate.sql \
  supabase/migrations/20261029041812_sacramentum_v294_decree_signer_role_name_and_audit.sql \
  supabase/deployment/20261114123014_validate_historical_dates_and_decree_registration_v327.sql \
  supabase/deployment/20261114173053_book_sequence_continuity_v330.sql \
  supabase/deployment/20261114173702_decree_book_sequence_continuity_v330.sql \
  supabase/migrations/20261025012000_registry_numeric_location_unique_v200.sql \
  scripts/qa-book-sequence-v330.sql
do
  docker exec -i "$PG_CONTAINER" psql -X -U postgres -d "$database" -v ON_ERROR_STOP=1 < "$file"
done
