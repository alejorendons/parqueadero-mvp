import test from 'node:test';
import assert from 'node:assert/strict';
import { invocationSchema, driverMessageSchema } from '../scripts/connector-preview/protocol.mjs';

test('el protocolo conserva argumentos y resultados con Zod 4 y rechaza selección de cuenta', () => {
  const call = {
    connectorId: 'example',
    actionName: 'read',
    arguments: { query: 'prueba', filters: { limit: 5 } },
  };
  assert.deepEqual(invocationSchema.parse(call), call);
  assert.equal(invocationSchema.safeParse({ ...call, accountId: 'other' }).success, false);
  const result = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    result: { content: [{ type: 'text', text: 'Resultado' }] },
  };
  assert.deepEqual(driverMessageSchema.parse(result), result);
  assert.equal(driverMessageSchema.safeParse({ ...result, id: 'invalid' }).success, false);
});
