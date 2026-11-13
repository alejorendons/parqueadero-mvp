import { sqliteTable, text, integer, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  data: text('data').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
export const stays = sqliteTable(
  'stays',
  {
    id: text('id').primaryKey(),
    plate: text('plate').notNull(),
    type: text('type').notNull(),
    entryAt: integer('entry_at').notNull(),
    exitAt: integer('exit_at'),
    rate: text('rate').notNull(),
    vehicleState: text('vehicle_state').notNull(),
    business: text('business').notNull(),
    actor: text('actor').notNull(),
  },
  (t) => [
    uniqueIndex('one_active_plate')
      .on(t.plate)
      .where(sql`${t.exitAt} IS NULL`),
    index('stays_entry').on(t.entryAt),
    check('vehicle_type', sql`${t.type} IN ('car','motorcycle')`),
    check('exit_after_entry', sql`${t.exitAt} IS NULL OR ${t.exitAt} >= ${t.entryAt}`),
  ],
);
export const shifts = sqliteTable(
  'shifts',
  {
    id: text('id').primaryKey(),
    openedAt: integer('opened_at').notNull(),
    closedAt: integer('closed_at'),
    opening: integer('opening').notNull(),
    counted: integer('counted'),
    expected: integer('expected'),
    difference: integer('difference'),
    note: text('note').notNull(),
    actor: text('actor').notNull(),
    closedBy: text('closed_by'),
  },
  (t) => [
    uniqueIndex('one_open_shift')
      .on(sql`(1)`)
      .where(sql`${t.closedAt} IS NULL`),
    check('opening_nonnegative', sql`${t.opening} >= 0`),
    check('counted_nonnegative', sql`${t.counted} IS NULL OR ${t.counted} >= 0`),
  ],
);
export const quotes = sqliteTable(
  'quotes',
  {
    id: text('id').primaryKey(),
    stayId: text('stay_id')
      .notNull()
      .references(() => stays.id),
    quotedAt: integer('quoted_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    total: integer('total').notNull(),
    blocks: integer('blocks').notNull(),
  },
  (t) => [index('quotes_stay').on(t.stayId)],
);
export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    stayId: text('stay_id')
      .notNull()
      .references(() => stays.id),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id),
    shiftId: text('shift_id')
      .notNull()
      .references(() => shifts.id),
    paidAt: integer('paid_at').notNull(),
    day: text('day').notNull(),
    total: integer('total').notNull(),
    method: text('method').notNull(),
    tendered: integer('tendered').notNull(),
    change: integer('change').notNull(),
    actor: text('actor').notNull(),
  },
  (t) => [
    uniqueIndex('one_payment_per_stay').on(t.stayId),
    uniqueIndex('one_payment_per_quote').on(t.quoteId),
    index('payments_day').on(t.day),
    check('payment_method', sql`${t.method} IN ('cash','transfer','card')`),
    check(
      'payment_amount',
      sql`${t.total} >= 0 AND ${t.tendered} >= ${t.total} AND ${t.change} = ${t.tendered} - ${t.total}`,
    ),
  ],
);
export const movements = sqliteTable(
  'movements',
  {
    id: text('id').primaryKey(),
    shiftId: text('shift_id')
      .notNull()
      .references(() => shifts.id),
    at: integer('at').notNull(),
    amount: integer('amount').notNull(),
    reason: text('reason').notNull(),
    actor: text('actor').notNull(),
  },
  (t) => [check('movement_not_zero', sql`${t.amount} != 0`)],
);
export const audit = sqliteTable('audit', {
  id: text('id').primaryKey(),
  at: integer('at').notNull(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  target: text('target').notNull(),
});
