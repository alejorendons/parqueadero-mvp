import { defaultSettings } from '../../domain/billing.mjs';
import { settingsSchema, shiftSchema } from '../../domain/contracts.mjs';
import type {
  CurrentShift,
  ParkingState,
  Quote,
  Receipt,
  Report,
  Stay,
} from '../../domain/parking-types';
export const now = Date.parse('2026-11-13T15:00:00Z');
export const config = settingsSchema.parse(defaultSettings);
export const stay: Stay = {
  id: 'stay-1',
  plate: 'ABC123',
  type: 'car',
  entry_at: now - 3600000,
  exit_at: null,
  rate: config.rates.car,
  business: config,
  vehicle_state: 'Sin novedades visibles',
  actor: 'Operador',
};
export const shift: CurrentShift = {
  id: 'shift-1',
  opened_at: now - 7200000,
  closed_at: null,
  opening: 50000,
  counted: null,
  expected: null,
  difference: null,
  note: '',
  actor: 'Operador',
  closed_by: null,
  current_expected: 54000,
};
export const quote: Quote = {
  id: 'quote-1',
  stay,
  quotedAt: now,
  expiresAt: now + 60000,
  elapsedMinutes: 60,
  blocks: 1,
  total: 4000,
};
export const receipt: Receipt = {
  stay: { ...stay, exit_at: now },
  quote: {
    id: quote.id,
    stay_id: stay.id,
    quoted_at: now,
    expires_at: now + 60000,
    total: 4000,
    blocks: 1,
  },
  payment: {
    id: 'payment-1',
    stay_id: stay.id,
    quote_id: quote.id,
    shift_id: shift.id,
    paid_at: now,
    day: '2026-11-13',
    total: 4000,
    method: 'cash',
    tendered: 10000,
    change: 6000,
    actor: 'Operador',
  },
};
export const paymentRow = {
  ...receipt.payment,
  plate: stay.plate,
  type: stay.type,
  entry_at: stay.entry_at,
  exit_at: now,
};
export const state: ParkingState = {
  now,
  config,
  active: [{ ...stay, estimate: { elapsedMinutes: 60, blocks: 1, total: 4000 } }],
  shift,
  recent: [paymentRow],
  today: [{ method: 'cash', count: 1, total: 4000 }],
  shifts: [shiftSchema.parse(shift)],
  movements: [],
  shiftSummary: {
    cash: 4000,
    transfer: 0,
    card: 0,
    total: 4000,
    paymentCount: 1,
    inflows: 0,
    outflows: 0,
  },
};
export const report: Report = {
  from: '2026-11-13',
  to: '2026-11-13',
  rows: [paymentRow],
  totals: { total: 4000, cash: 4000, transfer: 0, card: 0 },
};
