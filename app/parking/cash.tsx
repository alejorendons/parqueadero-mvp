import { useId, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, ChevronRight, Wallet } from 'lucide-react';
import type {
  CloseShiftInput,
  MoveInput,
  OpenShiftInput,
  ParkingCommand,
  ParkingState,
  Shift,
} from '../../domain/parking-types';
import {
  Button,
  Dialog,
  EmptyState,
  ErrorNotice,
  Field,
  Metric,
  Notice,
  Panel,
  SectionTitle,
} from './ui';
import { dateTime, money } from './format.mjs';

type CashProps = {
  data: ParkingState;
  pending: ParkingCommand['action'] | null;
  offline: boolean;
  error: Error | null;
  onOpen: (input: OpenShiftInput) => Promise<boolean>;
  onMove: (input: MoveInput) => Promise<boolean>;
  onClose: (input: CloseShiftInput) => Promise<Shift | undefined>;
  clearError: () => void;
};
function ShiftDetail({ shift }: { shift: Shift }) {
  return (
    <div className="shift-detail">
      <dl className="detail-list">
        <dt>Apertura</dt>
        <dd>{dateTime(shift.opened_at)}</dd>
        <dt>Cierre</dt>
        <dd>{shift.closed_at ? dateTime(shift.closed_at) : 'Turno abierto'}</dd>
        <dt>Base</dt>
        <dd>{money(shift.opening)}</dd>
        <dt>Efectivo esperado</dt>
        <dd>{shift.expected !== null ? money(shift.expected) : '—'}</dd>
        <dt>Efectivo contado</dt>
        <dd>{shift.counted !== null ? money(shift.counted) : '—'}</dd>
        <dt>Diferencia</dt>
        <dd className={shift.difference ? 'negative' : 'positive'}>
          {shift.difference !== null ? money(shift.difference) : '—'}
        </dd>
      </dl>
      {shift.note && (
        <div className="shift-note">
          <strong>Observaciones</strong>
          <p>{shift.note}</p>
        </div>
      )}
    </div>
  );
}
function MovementForm({
  shiftId,
  busy,
  disabled,
  onMove,
}: {
  shiftId: string;
  busy: boolean;
  disabled: boolean;
  onMove: CashProps['onMove'];
}) {
  const id = useId();
  const [direction, setDirection] = useState<'in' | 'out'>('out');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  return (
    <form
      className="stack-form"
      onSubmit={(e) => {
        e.preventDefault();
        const payload = { shiftId, direction, amount: Number(amount), reason: reason.trim() };
        const fingerprint = JSON.stringify(payload);
        if (attempt.current?.fingerprint !== fingerprint)
          attempt.current = { fingerprint, id: crypto.randomUUID() };
        void onMove({ ...payload, requestId: attempt.current.id }).then((success) => {
          if (success) {
            setAmount('');
            setReason('');
            attempt.current = null;
          }
        });
      }}
    >
      <Field id={`${id}-direction`} label="Tipo de movimiento">
        <select
          id={`${id}-direction`}
          value={direction}
          onChange={(e) => setDirection(e.target.value as 'in' | 'out')}
        >
          <option value="out">Retiro de efectivo</option>
          <option value="in">Ingreso adicional</option>
        </select>
      </Field>
      <Field id={`${id}-amount`} label="Valor · COP">
        <input
          id={`${id}-amount`}
          type="number"
          min={1}
          max={100000000}
          step={1}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <Field id={`${id}-reason`} label="Motivo">
        <input
          id={`${id}-reason`}
          required
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej. retiro para consignación"
        />
      </Field>
      <Button type="submit" variant="secondary" busy={busy} disabled={disabled}>
        {direction === 'out' ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}Registrar
        movimiento
      </Button>
    </form>
  );
}
export function Cash({
  data,
  pending,
  offline,
  error,
  onOpen,
  onMove,
  onClose,
  clearError,
}: CashProps) {
  const id = useId();
  const [opening, setOpening] = useState('');
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [review, setReview] = useState<(CloseShiftInput & { expected: number }) | null>(null);
  const [closed, setClosed] = useState<Shift | null>(null);
  const [detail, setDetail] = useState<Shift | null>(null);
  const busy = !!pending;
  const shift = data.shift;
  const totals = data.shiftSummary;
  const reviewExpected =
    review && data.shift?.id === review.shiftId
      ? data.shift.current_expected
      : (review?.expected ?? 0);
  return (
    <>
      {closed && (
        <Notice tone="success">
          <Check size={18} />
          <div>
            <strong>Turno cerrado y guardado.</strong>
            <p>Diferencia registrada: {money(closed.difference ?? 0)}</p>
          </div>
          <Button variant="quiet" onClick={() => setDetail(closed)}>
            Ver cierre
            <ChevronRight size={15} />
          </Button>
        </Notice>
      )}
      <div className="cash-overview">
        <div className="cash-status">
          <span className={`status-dot ${shift ? '' : 'status-muted'}`} />
          <div>
            <h2>{shift ? 'Turno en curso' : 'No hay un turno abierto'}</h2>
            <p>
              {shift
                ? `Abierto ${dateTime(shift.opened_at)}`
                : 'Abre caja con el efectivo que tienes para dar cambio.'}
            </p>
          </div>
        </div>
        {shift && <div className="cash-reference">{totals.paymentCount} pagos en este turno</div>}
      </div>
      {shift ? (
        <>
          <div className="cash-metrics">
            <Metric
              label="Efectivo esperado en caja"
              value={money(shift.current_expected)}
              detail="Este valor se compara con el conteo físico"
            />
            <Metric
              label="Recaudo del turno"
              value={money(totals.total)}
              detail={`${totals.paymentCount} pagos · Todos los medios`}
            />
            <Metric
              label="Pagos digitales"
              value={money(totals.card + totals.transfer)}
              detail="Se reportan aparte del efectivo"
            />
          </div>
          <Panel className="cash-equation">
            <div>
              <span>Base inicial</span>
              <strong>{money(shift.opening)}</strong>
            </div>
            <b>+</b>
            <div>
              <span>Ventas en efectivo</span>
              <strong>{money(totals.cash)}</strong>
            </div>
            <b>+</b>
            <div>
              <span>Ingresos</span>
              <strong>{money(totals.inflows)}</strong>
            </div>
            <b>−</b>
            <div>
              <span>Retiros</span>
              <strong>{money(totals.outflows)}</strong>
            </div>
            <b>=</b>
            <div className="equation-result">
              <span>Esperado</span>
              <strong>{money(shift.current_expected)}</strong>
            </div>
          </Panel>
          <div className="cash-actions">
            <Panel>
              <SectionTitle
                title="Movimiento de efectivo"
                description="Registra lo que entra o sale de la caja fuera de un cobro."
              />
              <div className="panel-body">
                <MovementForm
                  shiftId={shift.id}
                  busy={pending === 'move'}
                  disabled={busy || offline}
                  onMove={onMove}
                />
              </div>
            </Panel>
            <Panel>
              <SectionTitle
                title="Cerrar y cuadrar turno"
                description="Cuenta solo el efectivo físico, sin transferencias ni tarjetas."
              />
              <div className="panel-body">
                <form
                  className="stack-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    clearError();
                    setReview({
                      shiftId: shift.id,
                      counted: Number(counted),
                      note,
                      expected: shift.current_expected,
                    });
                  }}
                >
                  <Field id={`${id}-counted`} label="Efectivo contado · COP">
                    <input
                      id={`${id}-counted`}
                      type="number"
                      min={0}
                      max={100000000}
                      step={1}
                      required
                      value={counted}
                      onChange={(e) => setCounted(e.target.value)}
                    />
                  </Field>
                  <Field id={`${id}-note`} label="Observaciones del cierre">
                    <textarea
                      id={`${id}-note`}
                      rows={2}
                      maxLength={300}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Explica cualquier diferencia de efectivo"
                    />
                  </Field>
                  <Button type="submit" variant="secondary" disabled={busy || offline}>
                    Revisar cierre
                    <ArrowRight size={16} />
                  </Button>
                </form>
              </div>
            </Panel>
          </div>
          <Panel>
            <SectionTitle
              title="Movimientos del turno"
              description="Los cobros se incluyen en el recaudo. Aquí se muestran ingresos adicionales y retiros."
            />
            {data.movements.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Momento</th>
                      <th>Motivo</th>
                      <th>Movimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.movements.map((m) => (
                      <tr key={m.id}>
                        <td>{dateTime(m.at)}</td>
                        <td className="wrap-cell">{m.reason}</td>
                        <td className={`amount ${m.amount < 0 ? 'negative' : 'positive'}`}>
                          {m.amount > 0 ? '+ ' : ''}
                          {money(m.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="inline-empty">
                No has registrado ingresos adicionales ni retiros en este turno.
              </p>
            )}
          </Panel>
        </>
      ) : (
        <Panel className="open-shift-panel">
          <div className="open-shift-intro">
            <span>
              <Wallet size={30} />
            </span>
            <h2>Preparar caja</h2>
            <p>
              El fondo inicial es dinero disponible para cambio. Se mantiene separado de las ventas
              del turno.
            </p>
          </div>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              void onOpen({ opening: Number(opening) }).then((success) => {
                if (success) {
                  setOpening('');
                  setClosed(null);
                }
              });
            }}
          >
            <Field id={`${id}-opening`} label="Base inicial · COP">
              <input
                id={`${id}-opening`}
                type="number"
                min={0}
                max={100000000}
                step={1}
                required
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                placeholder="50000"
              />
            </Field>
            <Button type="submit" busy={pending === 'openShift'} disabled={busy || offline}>
              Abrir turno
              <ArrowRight size={17} />
            </Button>
          </form>
        </Panel>
      )}
      <Panel>
        <SectionTitle title="Historial de turnos" description="Últimos 15 turnos registrados." />
        {data.shifts.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Apertura</th>
                  <th>Estado</th>
                  <th>Esperado</th>
                  <th>Contado</th>
                  <th>Diferencia</th>
                  <th>
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.shifts.map((s) => (
                  <tr key={s.id}>
                    <td>{dateTime(s.opened_at)}</td>
                    <td>
                      <span className={`status-label ${s.closed_at ? 'closed' : ''}`}>
                        {s.closed_at ? 'Cerrado' : 'Abierto'}
                      </span>
                    </td>
                    <td className="amount">{s.expected !== null ? money(s.expected) : '—'}</td>
                    <td className="amount">{s.counted !== null ? money(s.counted) : '—'}</td>
                    <td className={`amount ${s.difference ? 'negative' : 'positive'}`}>
                      {s.difference !== null ? money(s.difference) : '—'}
                    </td>
                    <td>
                      <Button
                        variant="quiet"
                        aria-label={`Detalle del turno ${dateTime(s.opened_at)}`}
                        onClick={() => setDetail(s)}
                      >
                        Detalle
                        <ChevronRight size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Wallet size={26} />}
            title="Aún no hay turnos"
            description="El primer cierre quedará aquí con su conteo y diferencia."
          />
        )}
      </Panel>
      {review && (
        <Dialog title="Confirmar cierre de caja" busy={busy} onClose={() => setReview(null)}>
          <ErrorNotice error={error} />
          <p className="dialog-description">
            El cierre queda guardado y este turno deja de aceptar cobros.
          </p>
          <dl className="detail-list">
            <dt>Efectivo esperado</dt>
            <dd>{money(reviewExpected)}</dd>
            <dt>Conteo registrado</dt>
            <dd>{money(review.counted)}</dd>
            <dt>Diferencia prevista</dt>
            <dd className={review.counted - reviewExpected ? 'negative' : 'positive'}>
              {money(review.counted - reviewExpected)}
            </dd>
          </dl>
          <p className="field-hint">
            El saldo definitivo incluye los pagos confirmados hasta el instante del cierre.
          </p>
          <Button
            className="wide"
            busy={pending === 'closeShift'}
            disabled={offline || busy || data.shift?.id !== review.shiftId}
            onClick={() => {
              void onClose(review).then((result) => {
                if (result) {
                  setClosed(result);
                  setReview(null);
                  setCounted('');
                  setNote('');
                }
              });
            }}
          >
            Confirmar cierre
            <Check size={17} />
          </Button>
        </Dialog>
      )}
      {detail && (
        <Dialog title="Detalle del turno" onClose={() => setDetail(null)}>
          <ShiftDetail shift={detail} />
        </Dialog>
      )}
    </>
  );
}
