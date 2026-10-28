-- V253: sÃ³lo estructura, sin funciones QA.
CREATE TABLE sacramentum_ledger.seat_operations (
 operation_id uuid PRIMARY KEY,
 book_id uuid NOT NULL REFERENCES sacramentum_ledger.book_memories(id) ON DELETE RESTRICT,
 fingerprint text NOT NULL CHECK (length(fingerprint)=32),
 action text NOT NULL CHECK (action IN ('append','reverse')),
 response jsonb NOT NULL,
 actor_auth_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE sacramentum_ledger.seat_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_ledger.seat_operations FROM PUBLIC;

CREATE TABLE sacramentum_ledger.seat_dependencies (
 seat_id uuid NOT NULL REFERENCES sacramentum_ledger.active_seats(id) ON DELETE RESTRICT,
 dependency_type text NOT NULL,
 dependency_reference uuid NOT NULL,
 PRIMARY KEY (seat_id,dependency_type,dependency_reference)
);
ALTER TABLE sacramentum_ledger.seat_dependencies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_ledger.seat_dependencies FROM PUBLIC;

