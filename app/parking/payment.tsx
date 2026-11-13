import { useId, useState } from 'react';
import { ArrowRight, Banknote, Check, CreditCard, RefreshCw, Wallet } from 'lucide-react';
import type { PayInput, PaymentMethod, Quote } from '../../domain/parking-types';
import { Button, ErrorNotice, Field, Notice } from './ui';
import { dateTime, duration, methods, money, rateLabel, time } from './format.mjs';

export function PaymentPanel({
  quote,
  now,
  hasShift,
  busy,
  blocked = false,
  error,
  onPay,
  onRefresh,
  openCash,
}: {
  quote: Quote;
  now: number;
  hasShift: boolean;
  busy: boolean;
  blocked?: boolean;
  error: Error | null;
  onPay: (input: PayInput) => Promise<boolean>;
  onRefresh: () => void;
  openCash: () => void;
}) {
  const id = useId();
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [tendered, setTendered] = useState(String(quote.total));
  const [verification, setVerification] = useState<{ id: string; method: PaymentMethod } | null>(
    null,
  );
  const verified = verification?.id === quote.id && verification.method === method;
  const expired = now > quote.expiresAt;
  const needsVerification = method !== 'cash' && quote.total > 0;
  const received = Number(tendered);
  const change = Math.max(0, received - quote.total);
  return (
    <form
      className="payment-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && !blocked && hasShift && !expired && (!needsVerification || verified))
          void onPay({
            quoteId: quote.id,
            method,
            tendered: method === 'cash' ? received : quote.total,
          });
      }}
    >
      <div className="checkout-identity">
        <div>
          <span className="eyebrow">{quote.stay.type === 'car' ? 'Carro' : 'Moto'}</span>
          <h3 className="plate">{quote.stay.plate}</h3>
        </div>
        <div>
          <span>Entrada</span>
          <strong>{dateTime(quote.stay.entry_at)}</strong>
          <small>{duration(quote.elapsedMinutes)} de estadía</small>
        </div>
      </div>
      <div className="checkout-total">
        <span>Total a cobrar</span>
        <strong>{money(quote.total)}</strong>
        <p>
          {quote.blocks} {quote.blocks === 1 ? 'bloque' : 'bloques'} · {rateLabel(quote.stay.rate)}
        </p>
      </div>
      <div className={`quote-status ${expired ? 'expired' : ''}`}>
        <span>
          {expired
            ? 'El valor reservado venció.'
            : `Valor reservado por ${Math.min(60, Math.max(0, Math.ceil((quote.expiresAt - now) / 1000)))} s · Liquidado ${time(quote.quotedAt)}`}
        </span>
        <Button variant="quiet" disabled={busy} onClick={onRefresh}>
          <RefreshCw size={14} />
          {expired ? 'Actualizar valor' : 'Actualizar'}
        </Button>
      </div>
      <ErrorNotice error={error} />
      {!hasShift && (
        <Notice tone="warning">
          <Wallet size={18} />
          <div>
            <strong>Necesitas una caja abierta.</strong>
            <p>La estadía seguirá activa hasta registrar el pago.</p>
          </div>
          <Button variant="quiet" onClick={openCash}>
            Abrir caja
            <ArrowRight size={15} />
          </Button>
        </Notice>
      )}
      <fieldset className="method-choice">
        <legend>Medio de pago</legend>
        <div>
          {(['cash', 'transfer', 'card'] as const).map((m, i) => (
            <label key={m} htmlFor={`${id}-${m}`} className={method === m ? 'selected' : ''}>
              <input
                id={`${id}-${m}`}
                type="radio"
                name={`${id}-method`}
                value={m}
                checked={method === m}
                disabled={busy}
                onChange={() => {
                  setMethod(m);
                  setVerification(null);
                }}
              />
              {i === 0 ? <Banknote size={18} /> : <CreditCard size={18} />}
              <span>{methods[m]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {method === 'cash' ? (
        <>
          <Field id={`${id}-received`} label="Efectivo recibido · COP">
            <input
              id={`${id}-received`}
              type="number"
              min={quote.total}
              max={100000000}
              step={1}
              value={tendered}
              required
              disabled={busy}
              onChange={(e) => setTendered(e.target.value)}
            />
          </Field>
          <div className="change-due">
            <span>Cambio para el cliente</span>
            <strong>{money(change)}</strong>
          </div>
        </>
      ) : (
        <div className="digital-payment">
          <p>Verifica el pago en el banco o datáfono. Aquí se registra el pago recibido.</p>
          {needsVerification && (
            <label className="check-label" htmlFor={`${id}-verified`}>
              <input
                id={`${id}-verified`}
                type="checkbox"
                checked={verified}
                disabled={busy}
                onChange={(e) =>
                  setVerification(e.target.checked ? { id: quote.id, method } : null)
                }
              />
              Verifiqué que recibimos {money(quote.total)}
            </label>
          )}
        </div>
      )}
      <Button
        type="submit"
        busy={busy}
        className="wide"
        disabled={
          blocked ||
          !hasShift ||
          expired ||
          (needsVerification && !verified) ||
          (method === 'cash' && (!tendered || received < quote.total))
        }
      >
        <Check size={18} />
        Confirmar pago y salida
      </Button>
      <p className="field-hint">Al confirmar se guardan el pago y la salida juntos.</p>
    </form>
  );
}
