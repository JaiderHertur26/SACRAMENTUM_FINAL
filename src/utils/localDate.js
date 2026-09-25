/**
 * Returns a calendar date using the browser/local timezone.
 * Use this for institutional dates shown or entered as YYYY-MM-DD.
 * Do not use it for audit timestamps (created_at / updated_at), which remain UTC.
 */
export const getLocalDateISO = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default getLocalDateISO;
