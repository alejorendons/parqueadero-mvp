import { expect, it, vi } from 'vitest';
import {
  ApiError,
  fetchReceipt,
  fetchReport,
  fetchState,
  sendCommand,
} from '../../app/parking/api';
import { state, receipt, report, stay } from './fixtures';
it('valida respuestas reales y envía comandos con el encabezado que exige la API', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json(state))
    .mockResolvedValueOnce(Response.json(report))
    .mockResolvedValueOnce(Response.json(receipt))
    .mockResolvedValueOnce(Response.json(stay));
  vi.stubGlobal('fetch', fetch);
  expect(await fetchState()).toEqual(state);
  expect(await fetchReport('2026-11-13', '2026-11-13')).toEqual(report);
  expect(await fetchReceipt('p/?')).toEqual(receipt);
  await sendCommand({
    action: 'enter',
    plate: 'ABC123',
    type: 'car',
    vehicleState: 'Sin novedades',
  });
  expect(fetch).toHaveBeenLastCalledWith(
    '/api/parking',
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Parking-Request': '1' },
    }),
  );
  expect(fetch.mock.calls[2][0]).toMatch(/p%2F%3F/);
});
it('distingue lectura fallida de escritura incierta, error HTTP y contrato incompatible', async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('offline'))
    .mockRejectedValueOnce(new TypeError('offline'))
    .mockResolvedValueOnce(Response.json({ error: 'Caja cerrada' }, { status: 409 }))
    .mockResolvedValueOnce(new Response('not json'))
    .mockResolvedValueOnce(Response.json({ now: 'invalid' }))
    .mockResolvedValueOnce(Response.json({}, { status: 500 }));
  vi.stubGlobal('fetch', fetch);
  await expect(fetchState()).rejects.toMatchObject({ uncertain: false, status: 0 });
  await expect(sendCommand({ action: 'openShift', opening: 0 })).rejects.toMatchObject({
    uncertain: true,
  });
  await expect(sendCommand({ action: 'openShift', opening: 0 })).rejects.toMatchObject({
    status: 409,
    message: 'Caja cerrada',
  });
  await expect(fetchState()).rejects.toThrow(/incompleta/);
  await expect(fetchState()).rejects.toThrow(/formato esperado/);
  await expect(fetchState()).rejects.toThrow(/No se pudo/);
});
it('una lectura abortada conserva su identidad y no se presenta como un fallo de conexión', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')));
  await expect(fetchState()).rejects.toMatchObject({ name: 'AbortError' });
  expect(new ApiError('mensaje', 401).status).toBe(401);
});
