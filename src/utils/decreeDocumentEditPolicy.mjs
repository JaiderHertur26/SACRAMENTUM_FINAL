// Limited to documentary text of a new decree awaiting parish seat.
export const canEditChanceryDecreeDocument = (row={},chanceryId='') => {
  const p=row.payload||{};
  return !!row.id && !!chanceryId
    && String(row.chancery_id||'')===String(chanceryId)
    && row.status==='active'
    && !row.replacement_record_id
    && p.recordOrigin==='chancery_pending_seat_v280'
    && p.seatStatus==='awaiting_parish'
    && p.historical!==true && p.historical!=='true';
};
