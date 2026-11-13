import { Check, CircleParking, Printer } from 'lucide-react';
import type { ReceiptView } from '../../domain/parking-types';
import { Button } from './ui';
import { methods, money, rateLabel, receiptDate, time } from './format.mjs';

export function ReceiptPanel({ value }: { value: ReceiptView }) {
  const { stay } = value;
  const business = stay.business;
  const paid = value.kind === 'payment';
  return (
    <>
      <div className="receipt-confirmation">
        <Check size={17} />
        {paid ? 'Pago y salida guardados' : 'Entrada guardada'}
      </div>
      <div className="print-area receipt">
        <CircleParking size={32} className="receipt-mark" />
        <h3>{business.name}</h3>
        <p>{business.city}</p>
        {business.address && <p>{business.address}</p>}
        {business.nit && <p>NIT {business.nit}</p>}
        <div className="receipt-divider" />
        <span className="receipt-type">{paid ? 'Comprobante de pago' : 'Recibo de entrada'}</span>
        <h2 className="receipt-plate">{stay.plate}</h2>
        <p>{stay.type === 'car' ? 'Carro' : 'Moto'}</p>
        <dl className="receipt-details">
          <dt>Ingreso</dt>
          <dd>{receiptDate(stay.entry_at)}</dd>
          {paid && (
            <>
              <dt>Salida</dt>
              <dd>{receiptDate(stay.exit_at ?? value.payment.paid_at)}</dd>
            </>
          )}
          <dt>Tarifa de ingreso</dt>
          <dd>{rateLabel(stay.rate)}</dd>
          <dt>Tolerancia</dt>
          <dd>{stay.rate.graceMinutes} min</dd>
        </dl>
        <div className="receipt-observation">
          <strong>Estado al ingresar</strong>
          <p>{stay.vehicle_state}</p>
        </div>
        {paid && (
          <>
            <div className="receipt-divider" />
            <dl className="receipt-details">
              <dt>Bloques cobrados</dt>
              <dd>{value.quote.blocks}</dd>
              <dt>Liquidado</dt>
              <dd>{time(value.quote.quoted_at)}</dd>
              <dt>Medio</dt>
              <dd>{methods[value.payment.method]}</dd>
              <dt>Recibido</dt>
              <dd>{money(value.payment.tendered)}</dd>
              <dt>Cambio</dt>
              <dd>{money(value.payment.change)}</dd>
            </dl>
            <div className="receipt-amount">
              <span>Total pagado</span>
              <strong>{money(value.payment.total)}</strong>
            </div>
            <small className="receipt-reference">Pago {value.payment.id}</small>
          </>
        )}
        {(business.insurer || business.policy) && (
          <p className="receipt-insurance">
            {business.insurer} · Póliza {business.policy || 'Pendiente'}
          </p>
        )}
        {business.claims && <p className="receipt-insurance">Reclamaciones: {business.claims}</p>}
        <div className="receipt-divider" />
        <small className="receipt-reference">Estadía {stay.id}</small>
        <p>Conserva este comprobante.</p>
        <small>Documento operativo. No es factura electrónica.</small>
      </div>
      <Button className="wide receipt-print" onClick={() => window.print()}>
        <Printer size={18} />
        Imprimir comprobante
      </Button>
    </>
  );
}
