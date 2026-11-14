const parishClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Bogota',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

export function canSeatCelebration(dateValue, timeValue, now = new Date()) {
  const date = String(dateValue || '').trim().match(/^(\d{4}-\d{2}-\d{2})(?:T(.*))?$/);
  if (!date) return false;
  const time = String(timeValue || date[2] || '00:00').trim()
    .match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(\.\d+)?)?$/);
  if (!time) return false;

  const day = new Date(date[1]);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date[1]) return false;
  const civil = Object.fromEntries(parishClock.formatToParts(now).map(({type, value}) => [type, value]));
  const current = `${civil.year}-${civil.month}-${civil.day}T${civil.hour}:${civil.minute}:${civil.second}.${String(now.getUTCMilliseconds()).padStart(3, '0')}000`;
  const fraction = (time[4]?.slice(1) || '').padEnd(6, '0').slice(0, 6);
  return `${date[1]}T${time[1]}:${time[2]}:${time[3] || '00'}.${fraction}` <= current;
}
