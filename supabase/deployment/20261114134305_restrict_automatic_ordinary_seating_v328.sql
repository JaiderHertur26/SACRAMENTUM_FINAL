-- Public writers retained for rollback and maintenance by their owner.
REVOKE EXECUTE ON FUNCTION public.seat_baptism_records(uuid,jsonb,integer,integer,integer),
  public.seat_confirmation_records(uuid,jsonb,integer,integer,integer),
  public.seat_pending_marriage(uuid),
  public.seat_funeral_record(jsonb,uuid)
  FROM PUBLIC, anon, authenticated;
