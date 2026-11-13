import { normalizePlate, calculateCharge, bogotaDay, defaultSettings } from '../domain/billing.mjs';
import { settingsSchema, staySchema } from '../domain/contracts.mjs';
import type {
  BusinessSettings,
  Stay,
  CurrentShift,
  Shift,
  Movement,
  Payment,
  StoredQuote,
  PaymentRow,
  PaymentSummary,
  ShiftSummary,
  ParkingState,
  Report,
  EntryInput,
  PayInput,
  OpenShiftInput,
  MoveInput,
  CloseShiftInput,
} from '../domain/parking-types';
export class BusinessError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
type StoredStay = Omit<Stay, 'rate' | 'business'> & { rate: string; business: string };
type SqlValue = string | number | null;
const uuid = () => crypto.randomUUID();
const money = (value: unknown, label = 'Valor') => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 100000000)
    throw new BusinessError(`${label}: ingresa pesos enteros entre 0 y 100.000.000.`);
  return value;
};
const string = (value: unknown, max: number, required = false) => {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()))
    throw new BusinessError('Completa los campos requeridos y respeta su longitud máxima.');
  return value.trim();
};
const decode = (s: StoredStay): Stay =>
  staySchema.parse({
    ...s,
    rate: JSON.parse(s.rate),
    business: JSON.parse(s.business),
  });
const expectedSql = `(opening + COALESCE((SELECT SUM(total) FROM payments WHERE shift_id=shifts.id AND method='cash'),0) + COALESCE((SELECT SUM(amount) FROM movements WHERE shift_id=shifts.id),0))`;
export function parkingService(db: D1Database, actor: string, clock = Date.now) {
  const stmt = (sql: string, ...args: SqlValue[]) => db.prepare(sql).bind(...args);
  const all = async <T>(sql: string, ...args: SqlValue[]) =>
    (await stmt(sql, ...args).all<T>()).results;
  const first = <T>(sql: string, ...args: SqlValue[]) => stmt(sql, ...args).first<T>();
  const audit = (action: string, target: string, at: number) =>
    stmt('INSERT INTO audit VALUES (?,?,?,?,?)', uuid(), at, actor, action, target);
  const getSettings = async () => {
    const s = await first<{ data: string }>('SELECT data FROM settings WHERE id=1');
    return settingsSchema.parse(s ? JSON.parse(s.data) : structuredClone(defaultSettings));
  };
  const getStay = async (id: string) => {
    const s = await first<StoredStay>('SELECT * FROM stays WHERE id=?', id);
    if (!s) throw new BusinessError('Estadía no encontrada.', 404);
    return decode(s);
  };
  const shift = () =>
    first<CurrentShift>(
      `SELECT *, ${expectedSql} AS current_expected FROM shifts WHERE closed_at IS NULL`,
    );
  const receipt = async (id: string) => {
    const payment = await first<Payment>('SELECT * FROM payments WHERE id=?', id);
    if (!payment) throw new BusinessError('Pago no encontrado.', 404);
    const quote = await first<StoredQuote>('SELECT * FROM quotes WHERE id=?', payment.quote_id);
    if (!quote) throw new BusinessError('Liquidación del pago no encontrada.', 500);
    return { payment, stay: await getStay(payment.stay_id), quote };
  };
  const movementReplay = async (id: string, shiftId: string, amount: number, reason: string) => {
    const existing = await first<Movement>('SELECT * FROM movements WHERE id=?', id);
    if (!existing) return false;
    if (existing.shift_id !== shiftId || existing.amount !== amount || existing.reason !== reason)
      throw new BusinessError('Este identificador ya se usó en otro movimiento.', 409);
    return true;
  };
  return {
    async state(): Promise<ParkingState> {
      const now = clock();
      const [config, active, currentShift, recent, today, shifts, movements, shiftPayments] =
        await Promise.all([
          getSettings(),
          all<StoredStay>('SELECT * FROM stays WHERE exit_at IS NULL ORDER BY entry_at DESC'),
          shift(),
          all<PaymentRow>(
            'SELECT p.*,s.plate,s.type,s.entry_at,s.exit_at FROM payments p JOIN stays s ON s.id=p.stay_id ORDER BY p.paid_at DESC LIMIT 15',
          ),
          all<PaymentSummary>(
            'SELECT method,COUNT(*) AS count,SUM(total) AS total FROM payments WHERE day=? GROUP BY method',
            bogotaDay(now),
          ),
          all<Shift>('SELECT * FROM shifts ORDER BY opened_at DESC LIMIT 15'),
          all<Movement>(
            'SELECT * FROM movements WHERE shift_id IN (SELECT id FROM shifts WHERE closed_at IS NULL) ORDER BY at DESC',
          ),
          all<PaymentSummary>(
            'SELECT method,COUNT(*) AS count,SUM(total) AS total FROM payments WHERE shift_id IN (SELECT id FROM shifts WHERE closed_at IS NULL) GROUP BY method',
          ),
        ]);
      const shiftSummary: ShiftSummary = {
        cash: 0,
        transfer: 0,
        card: 0,
        total: 0,
        paymentCount: 0,
        inflows: 0,
        outflows: 0,
      };
      for (const p of shiftPayments) {
        shiftSummary[p.method] += p.total;
        shiftSummary.total += p.total;
        shiftSummary.paymentCount += p.count;
      }
      for (const m of movements) {
        if (m.amount > 0) shiftSummary.inflows += m.amount;
        else shiftSummary.outflows -= m.amount;
      }
      return {
        now,
        config,
        active: active.map((s) => ({
          ...decode(s),
          estimate: calculateCharge(s.entry_at, now, JSON.parse(s.rate)),
        })),
        shift: currentShift,
        recent,
        today,
        shifts,
        movements,
        shiftSummary,
      };
    },
    async saveSettings(data: BusinessSettings) {
      const clean = {
        name: string(data.name, 100, true),
        city: string(data.city, 100, true),
        address: string(data.address, 180),
        nit: string(data.nit, 40),
        policy: string(data.policy, 100),
        insurer: string(data.insurer, 120),
        claims: string(data.claims, 500),
        rates: {} as BusinessSettings['rates'],
      };
      for (const type of ['car', 'motorcycle'] as const) {
        const rate = data.rates?.[type];
        try {
          calculateCharge(0, 1, rate);
        } catch {
          throw new BusinessError(
            'Revisa las tarifas: bloque de 1, 15, 30 o 60 minutos; precio de $1 a $1.000.000; tolerancia de 0 a 60 minutos.',
          );
        }
        clean.rates[type] = {
          blockMinutes: rate.blockMinutes,
          blockPrice: rate.blockPrice,
          graceMinutes: rate.graceMinutes,
        };
      }
      const now = clock();
      await db.batch([
        stmt(
          'INSERT INTO settings VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',
          JSON.stringify(clean),
          now,
        ),
        audit('settings.updated', '1', now),
      ]);
      return clean;
    },
    async enter(data: EntryInput) {
      if (!['car', 'motorcycle'].includes(data.type))
        throw new BusinessError('Selecciona carro o moto.');
      let plate;
      try {
        plate = normalizePlate(data.plate, data.type);
      } catch (e) {
        throw new BusinessError((e as Error).message);
      }
      const observation = string(data.vehicleState, 500, true);
      const config = await getSettings();
      const id = uuid();
      const now = clock();
      try {
        await db.batch([
          stmt(
            'INSERT INTO stays (id,plate,type,entry_at,rate,vehicle_state,business,actor) VALUES (?,?,?,?,?,?,?,?)',
            id,
            plate,
            data.type,
            now,
            JSON.stringify(config.rates[data.type]),
            observation,
            JSON.stringify(config),
            actor,
          ),
          audit('stay.entered', id, now),
        ]);
      } catch (e) {
        if (/one_active_plate|stays.plate|UNIQUE constraint/i.test(String(e)))
          throw new BusinessError('Esta placa ya tiene una estadía activa.', 409);
        throw e;
      }
      return getStay(id);
    },
    async quote(id: string) {
      const stay = await getStay(id);
      if (stay.exit_at !== null) throw new BusinessError('El vehículo ya salió.', 409);
      const now = clock();
      const charge = calculateCharge(stay.entry_at, now, stay.rate);
      const quoteId = uuid();
      await stmt(
        'INSERT INTO quotes VALUES (?,?,?,?,?,?)',
        quoteId,
        id,
        now,
        now + 60000,
        charge.total,
        charge.blocks,
      ).run();
      return { id: quoteId, stay, quotedAt: now, expiresAt: now + 60000, ...charge };
    },
    async pay(data: PayInput) {
      const quoteId = string(data.quoteId, 60, true);
      const existing = await first<Payment>('SELECT * FROM payments WHERE quote_id=?', quoteId);
      if (existing) return receipt(existing.id);
      if (!['cash', 'transfer', 'card'].includes(data.method))
        throw new BusinessError('Selecciona un medio de pago válido.');
      const quote = await first<StoredQuote>('SELECT * FROM quotes WHERE id=?', quoteId);
      if (!quote) throw new BusinessError('Consulta de nuevo el cobro.', 404);
      const now = clock();
      if (now > quote.expires_at)
        throw new BusinessError('La cotización venció. Actualiza el cobro antes de pagar.', 409);
      const tendered =
        data.method === 'cash' ? money(data.tendered, 'Efectivo recibido') : quote.total;
      if (tendered < quote.total)
        throw new BusinessError('El efectivo recibido es menor al total.');
      const current = await shift();
      if (!current) throw new BusinessError('Abre caja antes de registrar el pago.', 409);
      const id = uuid();
      try {
        await db.batch([
          stmt(
            'INSERT INTO payments VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            id,
            quote.stay_id,
            quoteId,
            current.id,
            now,
            bogotaDay(now),
            quote.total,
            data.method,
            tendered,
            tendered - quote.total,
            actor,
          ),
          stmt('UPDATE stays SET exit_at=? WHERE id=? AND exit_at IS NULL', now, quote.stay_id),
          audit('stay.paid_and_exited', quote.stay_id, now),
        ]);
      } catch (e) {
        const retry = await first<Payment>('SELECT * FROM payments WHERE quote_id=?', quoteId);
        if (retry) return receipt(retry.id);
        if (/UNIQUE|closed_shift|inactive_stay/i.test(String(e)))
          throw new BusinessError(
            'La estadía ya fue pagada o la caja se cerró. Actualiza la pantalla.',
            409,
          );
        throw e;
      }
      return receipt(id);
    },
    receipt,
    async openShift(data: OpenShiftInput) {
      const opening = money(data.opening, 'Base de caja');
      const now = clock();
      const id = uuid();
      try {
        await db.batch([
          stmt(
            'INSERT INTO shifts (id,opened_at,opening,note,actor) VALUES (?,?,?,?,?)',
            id,
            now,
            opening,
            '',
            actor,
          ),
          audit('shift.opened', id, now),
        ]);
      } catch (e) {
        if (/UNIQUE/i.test(String(e))) throw new BusinessError('Ya existe una caja abierta.', 409);
        throw e;
      }
      return shift();
    },
    async move(data: MoveInput) {
      const amount = money(data.amount);
      if (!amount) throw new BusinessError('El movimiento debe ser mayor que cero.');
      if (!['in', 'out'].includes(data.direction))
        throw new BusinessError('Tipo de movimiento inválido.');
      const reason = string(data.reason, 200, true);
      const shiftId = string(data.shiftId, 60, true);
      const now = clock();
      const id = data.requestId ?? uuid();
      const signed = data.direction === 'out' ? -amount : amount;
      if (data.requestId && (await movementReplay(id, shiftId, signed, reason))) return shift();
      try {
        await db.batch([
          stmt(
            'INSERT INTO movements VALUES (?,?,?,?,?,?)',
            id,
            shiftId,
            now,
            signed,
            reason,
            actor,
          ),
          audit('cash.movement', id, now),
        ]);
      } catch (e) {
        if (data.requestId && /UNIQUE/i.test(String(e))) {
          if (await movementReplay(id, shiftId, signed, reason)) return shift();
        }
        if (/closed_shift|negative_cash|FOREIGN KEY/i.test(String(e)))
          throw new BusinessError(
            'La caja se cerró o el retiro supera el efectivo disponible.',
            409,
          );
        throw e;
      }
      return shift();
    },
    async closeShift(data: CloseShiftInput) {
      const id = string(data.shiftId, 60, true);
      const counted = money(data.counted, 'Efectivo contado');
      const note = string(data.note, 300);
      const now = clock();
      const result = await db.batch([
        stmt(
          `UPDATE shifts SET closed_at=?, counted=?, expected=${expectedSql}, difference=?-${expectedSql}, note=?, closed_by=? WHERE id=? AND closed_at IS NULL RETURNING *`,
          now,
          counted,
          counted,
          note,
          actor,
          id,
        ),
        stmt(
          'INSERT INTO audit SELECT ?,?,?,?,? WHERE changes()=1',
          uuid(),
          now,
          actor,
          'shift.closed',
          id,
        ),
      ]);
      if (!result[0].results.length)
        throw new BusinessError('Esta caja ya fue cerrada. Actualiza la pantalla.', 409);
      return result[0].results[0] as Shift;
    },
    async report(from: string, to: string): Promise<Report> {
      const valid = (s: string) =>
        /^\d{4}-\d{2}-\d{2}$/.test(s) &&
        !Number.isNaN(Date.parse(s)) &&
        new Date(s).toISOString().slice(0, 10) === s;
      if (
        !valid(from) ||
        !valid(to) ||
        from > to ||
        Date.parse(to) - Date.parse(from) > 92 * 86400000
      )
        throw new BusinessError('Elige un rango válido de máximo 93 días.');
      const rows = await all<PaymentRow>(
        'SELECT p.*,s.plate,s.type,s.entry_at,s.exit_at FROM payments p JOIN stays s ON s.id=p.stay_id WHERE p.day>=? AND p.day<=? ORDER BY p.paid_at DESC',
        from,
        to,
      );
      const totals = rows.reduce(
        (a, r) => ({ ...a, total: a.total + r.total, [r.method]: a[r.method] + r.total }),
        { total: 0, cash: 0, transfer: 0, card: 0 },
      );
      return { from, to, rows, totals };
    },
  };
}
