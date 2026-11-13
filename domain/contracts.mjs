import { z } from 'zod';

const integer = z.int();
const amount = integer.nonnegative();
const timestamp = amount;
export const vehicleTypeSchema = z.enum(['car', 'motorcycle']);
export const paymentMethodSchema = z.enum(['cash', 'transfer', 'card']);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const rateSchema = z.object({
  blockMinutes: z.union([z.literal(1), z.literal(15), z.literal(30), z.literal(60)]),
  blockPrice: integer.min(1).max(1000000),
  graceMinutes: integer.min(0).max(60),
});
export const settingsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  address: z.string().max(180),
  nit: z.string().max(40),
  policy: z.string().max(100),
  insurer: z.string().max(120),
  claims: z.string().max(500),
  rates: z.object({ car: rateSchema, motorcycle: rateSchema }),
});
export const staySchema = z.object({
  id: z.string(),
  plate: z.string(),
  type: vehicleTypeSchema,
  entry_at: timestamp,
  exit_at: timestamp.nullable(),
  rate: rateSchema,
  vehicle_state: z.string(),
  business: settingsSchema,
  actor: z.string(),
});
export const chargeSchema = z.object({ elapsedMinutes: amount, blocks: amount, total: amount });
export const activeStaySchema = staySchema.extend({ estimate: chargeSchema });
export const shiftSchema = z.object({
  id: z.string(),
  opened_at: timestamp,
  closed_at: timestamp.nullable(),
  opening: amount,
  counted: amount.nullable(),
  expected: amount.nullable(),
  difference: integer.nullable(),
  note: z.string(),
  actor: z.string(),
  closed_by: z.string().nullable(),
});
export const currentShiftSchema = shiftSchema.extend({ current_expected: amount });
export const movementSchema = z.object({
  id: z.string(),
  shift_id: z.string(),
  at: timestamp,
  amount: integer,
  reason: z.string(),
  actor: z.string(),
});
export const paymentSchema = z.object({
  id: z.string(),
  stay_id: z.string(),
  quote_id: z.string(),
  shift_id: z.string(),
  paid_at: timestamp,
  day: dateSchema,
  total: amount,
  method: paymentMethodSchema,
  tendered: amount,
  change: amount,
  actor: z.string(),
});
export const paymentRowSchema = paymentSchema.extend({
  plate: z.string(),
  type: vehicleTypeSchema,
  entry_at: timestamp,
  exit_at: timestamp,
});
export const storedQuoteSchema = z.object({
  id: z.string(),
  stay_id: z.string(),
  quoted_at: timestamp,
  expires_at: timestamp,
  total: amount,
  blocks: amount,
});
export const quoteSchema = chargeSchema.extend({
  id: z.string(),
  stay: staySchema,
  quotedAt: timestamp,
  expiresAt: timestamp,
});
export const receiptSchema = z.object({
  payment: paymentSchema,
  stay: staySchema,
  quote: storedQuoteSchema,
});
export const paymentSummarySchema = z.object({
  method: paymentMethodSchema,
  count: amount,
  total: amount,
});
export const shiftSummarySchema = z.object({
  cash: amount,
  transfer: amount,
  card: amount,
  total: amount,
  paymentCount: amount,
  inflows: amount,
  outflows: amount,
});
export const stateSchema = z.object({
  now: timestamp,
  config: settingsSchema,
  active: z.array(activeStaySchema),
  shift: currentShiftSchema.nullable(),
  recent: z.array(paymentRowSchema),
  today: z.array(paymentSummarySchema),
  shifts: z.array(shiftSchema),
  movements: z.array(movementSchema),
  shiftSummary: shiftSummarySchema,
});
export const reportSchema = z.object({
  from: dateSchema,
  to: dateSchema,
  rows: z.array(paymentRowSchema),
  totals: z.object({ total: amount, cash: amount, transfer: amount, card: amount }),
});
export const entryInputSchema = z.object({
  plate: z.string().min(1).max(12),
  type: vehicleTypeSchema,
  vehicleState: z.string().trim().min(1).max(500),
});
export const payInputSchema = z.object({
  quoteId: z.string().min(1).max(60),
  method: paymentMethodSchema,
  tendered: amount.max(100000000).optional(),
});
export const openShiftInputSchema = z.object({ opening: amount.max(100000000) });
export const moveInputSchema = z.object({
  shiftId: z.string().min(1).max(60),
  direction: z.enum(['in', 'out']),
  amount: amount.min(1).max(100000000),
  reason: z.string().trim().min(1).max(200),
  requestId: z.uuid().optional(),
});
export const closeShiftInputSchema = z.object({
  shiftId: z.string().min(1).max(60),
  counted: amount.max(100000000),
  note: z.string().max(300),
});
export const commandSchema = z.discriminatedUnion('action', [
  entryInputSchema.extend({ action: z.literal('enter') }),
  z.object({ action: z.literal('quote'), stayId: z.string().min(1).max(60) }),
  payInputSchema.extend({ action: z.literal('pay') }),
  z.object({ action: z.literal('settings'), config: settingsSchema }),
  openShiftInputSchema.extend({ action: z.literal('openShift') }),
  moveInputSchema.extend({ action: z.literal('move') }),
  closeShiftInputSchema.extend({ action: z.literal('closeShift') }),
]);
export const errorSchema = z.object({ error: z.string(), code: z.string().optional() });
