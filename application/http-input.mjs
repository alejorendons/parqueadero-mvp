import { commandSchema } from '../domain/contracts.mjs';

export class RequestInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function readCommand(request, limit = 12000) {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestInputError('Completa los datos de la operación.');
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new RequestInputError('La solicitud supera el tamaño permitido.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body;
  try {
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new RequestInputError('No se pudieron leer los datos enviados.');
  }
  const parsed = commandSchema.safeParse(body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.') ?? '';
    const labels = {
      plate: 'la placa',
      type: 'el tipo de vehículo',
      vehicleState: 'el estado del vehículo',
      tendered: 'el efectivo recibido',
      method: 'el medio de pago',
      opening: 'la base de caja',
      amount: 'el valor del movimiento',
      reason: 'el motivo',
      counted: 'el efectivo contado',
      note: 'las observaciones',
      requestId: 'la referencia del movimiento',
      config: 'la configuración',
    };
    throw new RequestInputError(
      `Revisa ${labels[field] ?? 'los campos de la operación'} y vuelve a intentar.`,
    );
  }
  return parsed.data;
}
