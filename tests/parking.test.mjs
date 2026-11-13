import test from 'node:test';
import assert from 'node:assert/strict';
import { parkingService } from '../application/parking-service.ts';
import { testDatabase } from './sqlite-adapter.mjs';
const start = Date.parse('2026-11-13T15:00:00Z');
function setup(t) {
  const db = testDatabase();
  t.after(() => db.close());
  let now = start;
  return {
    db,
    svc: parkingService(db, 'test-operator', () => now),
    advance: (ms) => {
      now += ms;
    },
  };
}
const car = { plate: 'abc123', type: 'car', vehicleState: 'Sin daños visibles' };
test('entrada persiste placa, estado, tarifa y reloj del servidor; impide duplicados', async (t) => {
  const { svc } = setup(t);
  const s = await svc.enter({ ...car, entryAt: 1 });
  assert.equal(s.plate, 'ABC123');
  assert.equal(s.entry_at, start);
  assert.equal(s.vehicle_state, car.vehicleState);
  await assert.rejects(svc.enter(car), /ya tiene/);
  assert.equal((await svc.state()).active.length, 1);
});
test('validaciones de entrada, configuración y caja', async (t) => {
  const { svc } = setup(t);
  await assert.rejects(svc.enter({ ...car, type: 'truck' }), /Selecciona/);
  await assert.rejects(svc.enter({ ...car, plate: '1' }), /Placa/);
  await assert.rejects(svc.enter({ ...car, vehicleState: '' }), /requeridos/);
  await assert.rejects(svc.saveSettings({}), /requeridos/);
  await assert.rejects(svc.openShift({ opening: -1 }), /pesos enteros/);
});
test('modificar tarifas no cambia las estadías existentes', async (t) => {
  const { svc, advance } = setup(t);
  const s = await svc.enter(car);
  const config = (await svc.state()).config;
  config.rates.car.blockPrice = 9000;
  await svc.saveSettings(config);
  advance(60000);
  assert.equal((await svc.quote(s.id)).total, 4000);
  const next = await svc.enter({ ...car, plate: 'DEF456' });
  advance(1000);
  assert.equal((await svc.quote(next.id)).total, 9000);
  config.rates.car.blockPrice = -1;
  await assert.rejects(svc.saveSettings(config), /tarifas/);
});
test('no permite cobrar con caja cerrada ni efectivo insuficiente', async (t) => {
  const { svc, advance } = setup(t);
  const s = await svc.enter(car);
  advance(60000);
  const q = await svc.quote(s.id);
  await assert.rejects(svc.pay({ quoteId: q.id, method: 'cash', tendered: 4000 }), /Abre caja/);
  await svc.openShift({ opening: 50000 });
  await assert.rejects(svc.openShift({ opening: 0 }), /Ya existe/);
  await assert.rejects(svc.pay({ quoteId: q.id, method: 'cash', tendered: 3000 }), /menor/);
  assert.equal((await svc.state()).active.length, 1);
});
test('pago y salida atómicos; reintento idempotente; placa puede reingresar', async (t) => {
  const { svc, advance } = setup(t);
  await svc.openShift({ opening: 50000 });
  const s = await svc.enter(car);
  advance(3600001);
  const q = await svc.quote(s.id);
  const p = await svc.pay({ quoteId: q.id, method: 'cash', tendered: 10000 });
  assert.equal(p.payment.total, 8000);
  assert.equal(p.payment.change, 2000);
  assert.ok(p.stay.exit_at);
  const retry = await svc.pay({ quoteId: q.id, method: 'cash', tendered: 10000 });
  assert.equal(retry.payment.id, p.payment.id);
  assert.equal((await svc.state()).shift.current_expected, 58000);
  assert.equal((await svc.state()).active.length, 0);
  await assert.rejects(svc.quote(s.id), /ya salió/);
  await svc.enter(car);
  assert.equal((await svc.report('2026-11-13', '2026-11-13')).rows.length, 1);
});
test('dos cotizaciones de la misma estadía generan un solo pago', async (t) => {
  const { svc, advance } = setup(t);
  await svc.openShift({ opening: 0 });
  const s = await svc.enter(car);
  advance(60000);
  const q1 = await svc.quote(s.id);
  const q2 = await svc.quote(s.id);
  const result = await Promise.allSettled([
    svc.pay({ quoteId: q1.id, method: 'transfer' }),
    svc.pay({ quoteId: q2.id, method: 'card' }),
  ]);
  assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await svc.report('2026-11-13', '2026-11-13')).rows.length, 1);
});
test('cotización expirada no cobra ni saca el vehículo', async (t) => {
  const { svc, advance } = setup(t);
  await svc.openShift({ opening: 0 });
  const s = await svc.enter(car);
  advance(60000);
  const q = await svc.quote(s.id);
  advance(60001);
  await assert.rejects(svc.pay({ quoteId: q.id, method: 'transfer' }), /venció/);
  assert.equal((await svc.state()).active.length, 1);
});
test('la base de datos bloquea pagos y movimientos contra un turno cerrado', async (t) => {
  const { svc, db, advance } = setup(t);
  const shift = await svc.openShift({ opening: 50000 });
  const s = await svc.enter(car);
  advance(60000);
  const q = await svc.quote(s.id);
  await svc.closeShift({ shiftId: shift.id, counted: 50000, note: '' });
  await assert.rejects(
    svc.move({ shiftId: shift.id, direction: 'in', amount: 1000, reason: 'Prueba' }),
    /cerró/,
  );
  await assert.rejects(
    db
      .prepare('INSERT INTO payments VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind('p', s.id, q.id, shift.id, start + 60000, '2026-11-13', 4000, 'cash', 4000, 0, 'test')
      .run(),
    /closed_shift/,
  );
  assert.equal((await svc.state()).active.length, 1);
});
test('transferencias y tarjetas no aumentan efectivo; movimientos y cierre cuadran', async (t) => {
  const { svc, advance } = setup(t);
  const shift = await svc.openShift({ opening: 50000 });
  for (const [plate, method] of [
    ['ABC123', 'cash'],
    ['DEF456', 'transfer'],
    ['GHI789', 'card'],
  ]) {
    const s = await svc.enter({ ...car, plate });
    advance(1000);
    const q = await svc.quote(s.id);
    await svc.pay({ quoteId: q.id, method, tendered: 4000 });
  }
  await svc.move({ shiftId: shift.id, direction: 'out', amount: 10000, reason: 'Consignación' });
  await svc.move({ shiftId: shift.id, direction: 'in', amount: 2000, reason: 'Cambio adicional' });
  await assert.rejects(
    svc.move({ shiftId: shift.id, direction: 'out', amount: 100000, reason: 'Exceso' }),
    /supera/,
  );
  assert.equal((await svc.state()).shift.current_expected, 46000);
  const closed = await svc.closeShift({ shiftId: shift.id, counted: 45500, note: 'Faltan $500' });
  assert.equal(closed.expected, 46000);
  assert.equal(closed.difference, -500);
  await assert.rejects(
    svc.closeShift({ shiftId: shift.id, counted: 45500, note: '' }),
    /ya fue cerrada/,
  );
  const report = await svc.report('2026-11-13', '2026-11-13');
  assert.deepEqual(report.totals, { total: 12000, cash: 4000, transfer: 4000, card: 4000 });
  assert.equal((await svc.state()).shift, null);
});
test('reportes validan fechas y mantienen recibos recuperables', async (t) => {
  const { svc } = setup(t);
  await assert.rejects(svc.report('2026-02-30', '2026-03-01'), /rango válido/);
  await assert.rejects(svc.report('2026-01-01', '2026-12-31'), /93 días/);
  await assert.rejects(svc.receipt('missing'), /no encontrado/);
  await assert.rejects(svc.quote('missing'), /no encontrada/);
});
test('una falla al final del batch revierte tanto el pago como la salida', async (t) => {
  const { svc, db, advance } = setup(t);
  await svc.openShift({ opening: 0 });
  const s = await svc.enter(car);
  advance(60000);
  const q = await svc.quote(s.id);
  const failingDb = {
    prepare: db.prepare,
    batch: (statements) =>
      db.batch([...statements, db.prepare('INSERT INTO missing_table VALUES (1)')]),
  };
  const broken = parkingService(failingDb, 'test-operator', () => start + 60000);
  await assert.rejects(broken.pay({ quoteId: q.id, method: 'transfer' }), /missing_table/);
  assert.equal((await svc.state()).active.length, 1);
  assert.equal((await svc.report('2026-11-13', '2026-11-13')).rows.length, 0);
  const paid = await svc.pay({ quoteId: q.id, method: 'transfer' });
  assert.equal(paid.payment.total, 4000);
});

test('reintentar un movimiento, incluso concurrentemente, solo afecta una vez al saldo y auditoría', async (t) => {
  const { svc, db } = setup(t);
  const shift = await svc.openShift({ opening: 50000 });
  const input = {
    shiftId: shift.id,
    direction: 'out',
    amount: 10000,
    reason: 'Consignación',
    requestId: crypto.randomUUID(),
  };
  await Promise.all([svc.move(input), svc.move(input)]);
  await svc.move(input);
  assert.equal((await svc.state()).shift.current_expected, 40000);
  assert.equal((await svc.state()).movements.length, 1);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS n FROM audit WHERE action='cash.movement'").first()).n,
    1,
  );
  await assert.rejects(svc.move({ ...input, amount: 9000 }), /identificador/);
});

test('cerrar dos veces en el mismo milisegundo no duplica la auditoría de cierre', async (t) => {
  const { svc, db } = setup(t);
  const shift = await svc.openShift({ opening: 0 });
  const input = { shiftId: shift.id, counted: 0, note: '' };
  await svc.closeShift(input);
  await assert.rejects(svc.closeShift(input), /ya fue cerrada/);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS n FROM audit WHERE action='shift.closed'").first()).n,
    1,
  );
});
