import test from 'node:test';
import assert from 'node:assert/strict';
import { canSeatCelebration } from '../src/domain/celebrationTime.mjs';

test('Un asiento sigue la fecha civil de la parroquia', () => {
  const beforeMidnight = new Date('2026-11-15T04:55:00Z');
  assert.equal(canSeatCelebration('2026-11-15', '', beforeMidnight), false);
  const morning = new Date('2026-11-14T13:10:00Z');
  assert.equal(canSeatCelebration('2026-11-14', '07:59', morning), true);
  assert.equal(canSeatCelebration('2026-11-14', '08:10:00', morning), true);
  assert.equal(canSeatCelebration('2026-11-14T08:10:00.001', '', morning), false);
  assert.equal(canSeatCelebration('2026-11-14T08:11', '', morning), false);
  assert.equal(canSeatCelebration('2026-11-14', '', morning), true);
});

test('Un asiento requiere una fecha válida y verifica la hora si está registrada', () => {
  const now = new Date('2026-11-14T13:10:00Z');
  for (const [date, time] of [['', '06:00'], ['2026-02-31', '06:00'], ['2026-11-01', '26:00']]) {
    assert.equal(canSeatCelebration(date, time, now), false);
  }
});
