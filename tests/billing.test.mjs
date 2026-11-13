import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlate, calculateCharge, bogotaDay } from '../domain/billing.mjs';
const rate = { blockMinutes: 60, blockPrice: 4000, graceMinutes: 0 };
test('normaliza placas de carro y moto y rechaza formatos incorrectos', () => {
  assert.equal(normalizePlate(' abc-123 ', 'car'), 'ABC123');
  assert.equal(normalizePlate('abc12d', 'motorcycle'), 'ABC12D');
  assert.equal(normalizePlate('abc12', 'motorcycle'), 'ABC12');
  assert.throws(() => normalizePlate('ABC12D', 'car'));
  assert.throws(() => normalizePlate('<script>', 'motorcycle'));
});
for (const [ms, total] of [
  [0, 0],
  [1, 4000],
  [3599999, 4000],
  [3600000, 4000],
  [3600001, 8000],
  [86400000, 96000],
]) {
  test(`liquida correctamente el límite de ${ms} milisegundos`, () =>
    assert.equal(calculateCharge(0, ms, rate).total, total));
}
test('tolerancia exonera hasta su límite y luego cobra el tiempo completo', () => {
  const r = { ...rate, graceMinutes: 10 };
  assert.equal(calculateCharge(0, 600000, r).total, 0);
  assert.equal(calculateCharge(0, 600001, r).total, 4000);
  assert.equal(calculateCharge(0, 61 * 60000, r).total, 8000);
});
test('bloques por minuto y tarifa distinta para moto', () => {
  assert.equal(
    calculateCharge(0, 60001, { blockMinutes: 1, blockPrice: 100, graceMinutes: 0 }).total,
    200,
  );
  assert.equal(calculateCharge(0, 3600001, { ...rate, blockPrice: 2000 }).total, 4000);
});
test('rechaza intervalos y tarifas inválidos', () => {
  assert.throws(() => calculateCharge(10, 1, rate));
  assert.throws(() => calculateCharge(0, 1, { ...rate, blockPrice: 0.5 }));
  assert.throws(() => calculateCharge(0, 1, { ...rate, blockMinutes: 7 }));
  assert.throws(() => calculateCharge(0, 1, undefined));
});
test('la medianoche de Colombia define el día, sin depender del equipo', () => {
  assert.equal(bogotaDay(Date.parse('2026-11-14T04:59:59Z')), '2026-11-13');
  assert.equal(bogotaDay(Date.parse('2026-11-14T05:00:00Z')), '2026-11-14');
});
