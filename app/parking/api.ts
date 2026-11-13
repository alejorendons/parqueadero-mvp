import { z } from 'zod';
import {
  stateSchema,
  quoteSchema,
  staySchema,
  receiptSchema,
  settingsSchema,
  currentShiftSchema,
  shiftSchema,
  reportSchema,
  errorSchema,
} from '../../domain/contracts.mjs';
import type {
  ParkingCommand,
  ParkingState,
  Quote,
  Stay,
  Receipt,
  BusinessSettings,
  CurrentShift,
  Shift,
  Report,
} from '../../domain/parking-types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public uncertain = false,
  ) {
    super(message);
  }
}
async function request(query: string, init: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/api/parking${query}`, { cache: 'no-store', ...init });
  } catch (error) {
    if ((error instanceof Error || error instanceof DOMException) && error.name === 'AbortError')
      throw error;
    const writing = init.method === 'POST';
    throw new ApiError(
      writing
        ? 'No recibimos confirmación. Actualiza los datos antes de volver a intentar; la operación puede haberse guardado.'
        : 'No pudimos conectar. Revisa tu conexión y vuelve a actualizar.',
      0,
      writing,
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      'La respuesta llegó incompleta. Actualiza para comprobar el estado.',
      response.status,
      init.method === 'POST',
    );
  }
  if (!response.ok) {
    const error = errorSchema.safeParse(body);
    throw new ApiError(
      error.success ? error.data.error : 'No se pudo completar la operación.',
      response.status,
    );
  }
  return body;
}
function checked<T>(schema: z.ZodType<T>, value: unknown, uncertain = false): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(
      'Los datos recibidos no tienen el formato esperado. Actualiza la página para comprobar el estado.',
      0,
      uncertain,
    );
  return parsed.data;
}
export async function fetchState(signal?: AbortSignal): Promise<ParkingState> {
  return checked(stateSchema, await request('', { signal }));
}
export async function fetchReport(from: string, to: string): Promise<Report> {
  return checked(
    reportSchema,
    await request(`?action=report&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  );
}
export async function fetchReceipt(id: string): Promise<Receipt> {
  return checked(receiptSchema, await request(`?action=receipt&id=${encodeURIComponent(id)}`));
}
export interface CommandResults {
  enter: Stay;
  quote: Quote;
  pay: Receipt;
  settings: BusinessSettings;
  openShift: CurrentShift | null;
  move: CurrentShift | null;
  closeShift: Shift;
}
const resultSchemas: { [A in keyof CommandResults]: z.ZodType<CommandResults[A]> } = {
  enter: staySchema,
  quote: quoteSchema,
  pay: receiptSchema,
  settings: settingsSchema,
  openShift: currentShiftSchema.nullable(),
  move: currentShiftSchema.nullable(),
  closeShift: shiftSchema,
};
export async function sendCommand<C extends ParkingCommand>(
  command: C,
): Promise<CommandResults[C['action']]> {
  const value = await request('', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Parking-Request': '1' },
    body: JSON.stringify(command),
  });
  // The schema map checks every action/result pair above; this preserves that
  // relationship through TypeScript's generic indexed access.
  return checked<CommandResults[keyof CommandResults]>(
    resultSchemas[command.action],
    value,
    true,
  ) as CommandResults[C['action']];
}
