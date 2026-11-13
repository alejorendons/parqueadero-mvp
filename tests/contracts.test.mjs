import test from 'node:test';
import assert from 'node:assert/strict';
import { readCommand, RequestInputError } from '../application/http-input.mjs';
import { receiptSchema, stateSchema } from '../domain/contracts.mjs';
import { parkingService } from '../application/parking-service.ts';
import { testDatabase } from './sqlite-adapter.mjs';
import { csvCell, duration, reportCsv } from '../app/parking/format.mjs';

const request = (body) => new Request('https://parking.test/api/parking', { method: 'POST', body });
test('el contrato de entrada rechaza coerciones, acciones desconocidas y campos inválidos', async () => {
  const valid = {
    action: 'enter',
    plate: 'ABC123',
    type: 'car',
    vehicleState: '  Sin novedades  ',
  };
  assert.equal((await readCommand(request(JSON.stringify(valid)))).vehicleState, 'Sin novedades');
  for (const body of [
    { action: 'erase' },
    { action: 'openShift', opening: '50000' },
    { ...valid, type: 'truck' },
    { ...valid, vehicleState: '' },
  ]) {
    await assert.rejects(
      readCommand(request(JSON.stringify(body))),
      (e) => e instanceof RequestInputError && e.status === 400 && /Revisa/.test(e.message),
    );
  }
  await assert.rejects(readCommand(request('{broken')), /leer los datos/);
  await assert.rejects(readCommand(request(new Uint8Array([255]))), /leer los datos/);
  await assert.rejects(readCommand(new Request('https://parking.test')), /Completa/);
});
test('el límite de cuerpo se aplica a bytes recibidos aunque no exista Content-Length', async () => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ action: 'openShift', opening: 0, padding: 'á'.repeat(7000) }),
  );
  let canceled = false;
  const body = new ReadableStream({
    start(c) {
      c.enqueue(bytes.slice(0, 100));
      c.enqueue(bytes.slice(100));
    },
    cancel() {
      canceled = true;
    },
  });
  await assert.rejects(
    readCommand(new Request('https://parking.test', { method: 'POST', body, duplex: 'half' })),
    (e) => e.status === 413,
  );
  assert.equal(canceled, true);
});
test('respuestas reales del servicio satisfacen los contratos compartidos', async (t) => {
  const db = testDatabase();
  t.after(() => db.close());
  let now = Date.parse('2026-11-13T15:00:00Z');
  const svc = parkingService(db, 'operador', () => now);
  stateSchema.parse(await svc.state());
  const shift = await svc.openShift({ opening: 50000 });
  for (const [plate, method] of [
    ['ABC123', 'cash'],
    ['DEF456', 'transfer'],
    ['GHI789', 'card'],
  ]) {
    const stay = await svc.enter({ plate, type: 'car', vehicleState: 'Sin novedades' });
    now += 1000;
    const quote = await svc.quote(stay.id);
    receiptSchema.parse(await svc.pay({ quoteId: quote.id, method, tendered: 10000 }));
  }
  await svc.move({ shiftId: shift.id, direction: 'in', amount: 2000, reason: 'Cambio' });
  await svc.move({ shiftId: shift.id, direction: 'out', amount: 1000, reason: 'Retiro' });
  const state = stateSchema.parse(await svc.state());
  assert.deepEqual(state.shiftSummary, {
    cash: 4000,
    transfer: 4000,
    card: 4000,
    total: 12000,
    paymentCount: 3,
    inflows: 2000,
    outflows: 1000,
  });
  assert.equal(state.shift.current_expected, 55000);
  const csv = reportCsv(await svc.report('2026-11-13', '2026-11-13'));
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /2026/);
  assert.match(csv, /10:00:01/);
  assert.match(csv, /Transferencia/);
});
test('CSV protege fórmulas y comillas; el tiempo nunca es negativo', () => {
  assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(-4000), '"-4000"');
  assert.equal(duration(-1), '0 min');
  assert.equal(duration(61), '1 h 1 min');
});
