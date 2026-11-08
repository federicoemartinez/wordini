import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayNumber, LAUNCH_DATE } from '../js/puzzle.js';

test('dayNumber: consecutivo a cualquier hora, también al cambiar el horario', () => {
  const tz = process.env.TZ;
  try {
    for (const zone of ['America/New_York', 'Europe/Paris', 'America/Argentina/Buenos_Aires']) {
      process.env.TZ = zone;
      const [y, m, d] = LAUNCH_DATE;
      for (let i = 0; i < 400; i++) {
        for (const [h, min] of [[0, 30], [12, 0], [23, 59]]) {
          assert.equal(dayNumber(new Date(y, m, d + i, h, min)), i, `${zone} día ${i} ${h}:${min}`);
        }
      }
    }
  } finally {
    process.env.TZ = tz;
  }
});

test('dayNumber: 23:59 y 00:01 son días distintos; antes del lanzamiento es 0', () => {
  const [y, m, d] = LAUNCH_DATE;
  assert.equal(dayNumber(new Date(y, m, d + 5, 0, 1)) - dayNumber(new Date(y, m, d + 4, 23, 59)), 1);
  assert.equal(dayNumber(new Date(y, m, d - 30)), 0);
});
