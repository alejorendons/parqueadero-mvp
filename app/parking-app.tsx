'use client';

import { useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  CircleParking,
  LayoutList,
  RefreshCw,
  Settings2,
  Wallet,
} from 'lucide-react';
import type {
  BusinessSettings,
  EntryInput,
  PayInput,
  Quote,
  ReceiptView,
} from '../domain/parking-types';
import { fetchReceipt } from './parking/api';
import { Cash } from './parking/cash';
import { Operation } from './parking/operation';
import { PaymentPanel } from './parking/payment';
import { ReceiptPanel } from './parking/receipt';
import { Reports } from './parking/reports';
import { Settings } from './parking/settings';
import { Button, Dialog, ErrorNotice, LoadingWorkspace, Notice } from './parking/ui';
import { useClock, useParking } from './parking/use-parking';
import { money, time } from './parking/format.mjs';

const sections = [
  {
    id: 'operation',
    name: 'Operación',
    icon: LayoutList,
    description: 'Entradas, vehículos presentes y salidas.',
  },
  {
    id: 'cash',
    name: 'Caja',
    icon: Wallet,
    description: 'Controla el efectivo y cuadra cada turno.',
  },
  {
    id: 'reports',
    name: 'Reportes',
    icon: BarChart3,
    description: 'Consulta los pagos y descarga el detalle del período.',
  },
  {
    id: 'settings',
    name: 'Tarifas y datos',
    icon: Settings2,
    description: 'Configura el cobro y los datos de tus comprobantes.',
  },
] as const;
type Section = (typeof sections)[number]['id'];

export default function ParkingApp({
  operator,
  initialNow,
}: {
  operator: string;
  initialNow: number;
}) {
  const {
    data,
    loadError,
    actionError,
    refreshing,
    pending,
    offset,
    refresh,
    perform,
    clearError,
  } = useParking();
  const now = useClock(initialNow, offset);
  const [section, setSection] = useState<Section>('operation');
  const [dirty, setDirty] = useState(false);
  const [destination, setDestination] = useState<Section | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);
  const [receiptError, setReceiptError] = useState<Error | null>(null);
  const [readingReceipt, setReadingReceipt] = useState(false);
  const busy = !!pending;
  const current = sections.find((s) => s.id === section)!;
  const navigate = (next: Section) => {
    if (next === section || busy) return;
    if (dirty) {
      setDestination(next);
      return;
    }
    clearError();
    setReceiptError(null);
    setSection(next);
  };
  const charge = async (stayId: string) => {
    const result = await perform({ action: 'quote', stayId });
    if (result) {
      setReceipt(null);
      setQuote(result);
    }
  };
  const enter = async (input: EntryInput) => {
    const stay = await perform({ action: 'enter', ...input });
    if (stay) setReceipt({ kind: 'entry', stay });
    return !!stay;
  };
  const pay = async (input: PayInput) => {
    const result = await perform({ action: 'pay', ...input });
    if (result) {
      setQuote(null);
      setReceipt({ kind: 'payment', ...result });
    }
    return !!result;
  };
  const readReceipt = async (id: string) => {
    setReadingReceipt(true);
    setReceiptError(null);
    try {
      setReceipt({ kind: 'payment', ...(await fetchReceipt(id)) });
    } catch (error) {
      setReceiptError(
        error instanceof Error ? error : new Error('No pudimos abrir el comprobante.'),
      );
    } finally {
      setReadingReceipt(false);
    }
  };
  const save = async (config: BusinessSettings) => perform({ action: 'settings', config });
  const openCash = () => {
    setQuote(null);
    navigate('cash');
  };

  return (
    <div className="product-shell">
      <a className="skip-link" href="#workspace">
        Ir al área de trabajo
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span>
            <CircleParking size={27} />
          </span>
          <div>
            <strong>Parqueo</strong>
            <small>Control del parqueadero</small>
          </div>
        </div>
        <div className="business-label">
          <strong>{data?.config.name ?? 'Tu parqueadero'}</strong>
          <span>{data?.config.city ?? 'El Retiro, Antioquia'}</span>
        </div>
        <nav className="primary-nav" aria-label="Navegación principal">
          {sections.map(({ id, name, icon: Icon }) => (
            <button
              type="button"
              key={id}
              aria-label={name}
              aria-current={section === id ? 'page' : undefined}
              disabled={busy}
              onClick={() => navigate(id)}
            >
              <Icon size={20} />
              <span>{name}</span>
              {id === 'operation' && data && <b>{data.active.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {data && (
            <button
              type="button"
              className="sidebar-shift"
              disabled={busy}
              onClick={() => navigate('cash')}
            >
              <span className={`status-dot ${data.shift ? '' : 'status-muted'}`} />
              <span>
                {data.shift ? 'Caja abierta' : 'Caja cerrada'}
                <strong>
                  {data.shift ? money(data.shift.current_expected) : 'Preparar turno'}
                </strong>
              </span>
              <ArrowUpRight size={16} />
            </button>
          )}
          <div className="operator">
            <span>{operator.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{operator}</strong>
              <small>Sesión privada</small>
            </div>
          </div>
        </div>
      </aside>
      <main id="workspace" className="workspace" tabIndex={-1}>
        <header className="workspace-heading">
          <div>
            <span className="eyebrow">
              {new Intl.DateTimeFormat('es-CO', {
                timeZone: 'America/Bogota',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(now)}
            </span>
            <h1>{current.name}</h1>
            <p>{current.description}</p>
          </div>
          <div className="sync-control">
            <span className={`status-dot ${loadError ? 'status-warning' : ''}`} />
            <span>
              {data
                ? loadError
                  ? 'Datos sin actualizar'
                  : `Actualizado ${time(data.now)}`
                : 'Conectando'}
            </span>
            <Button
              variant="quiet"
              busy={refreshing}
              aria-label="Actualizar datos"
              onClick={() => {
                void refresh();
              }}
            >
              <RefreshCw size={17} />
            </Button>
          </div>
        </header>
        <ErrorNotice
          error={loadError}
          onRetry={() => {
            void refresh();
          }}
        />
        {loadError && data && (
          <Notice tone="warning">
            <p>
              Conservamos la última consulta. Actualiza los datos para volver a registrar cambios.
            </p>
          </Notice>
        )}
        {!quote && <ErrorNotice error={actionError} />}
        <ErrorNotice error={receiptError} />
        {readingReceipt && (
          <p className="reading-status" role="status">
            Abriendo comprobante…
          </p>
        )}
        {!data && !loadError && <LoadingWorkspace />}
        {data && (
          <>
            {section === 'operation' && (
              <Operation
                data={data}
                now={now}
                busy={busy}
                offline={!!loadError}
                onEnter={enter}
                onCharge={(id) => {
                  void charge(id);
                }}
                onEntryReceipt={(stay) => setReceipt({ kind: 'entry', stay })}
                onPaymentReceipt={(id) => {
                  void readReceipt(id);
                }}
                openCash={openCash}
                openReports={() => navigate('reports')}
              />
            )}
            {section === 'cash' && (
              <Cash
                data={data}
                pending={pending}
                offline={!!loadError}
                error={actionError}
                clearError={clearError}
                onOpen={async (input) => !!(await perform({ action: 'openShift', ...input }))}
                onMove={async (input) => !!(await perform({ action: 'move', ...input }))}
                onClose={(input) =>
                  perform({
                    action: 'closeShift',
                    shiftId: input.shiftId,
                    counted: input.counted,
                    note: input.note,
                  })
                }
              />
            )}
            {section === 'reports' && (
              <Reports
                now={now}
                onReceipt={(id) => {
                  void readReceipt(id);
                }}
              />
            )}
            {section === 'settings' && (
              <Settings
                config={data.config}
                busy={pending === 'settings'}
                offline={!!loadError}
                now={now}
                onSave={save}
                onDirty={setDirty}
              />
            )}
          </>
        )}
        <footer className="workspace-footer">
          <span>Hora y fechas de Colombia</span>
          <span>Valores en pesos · COP</span>
        </footer>
      </main>
      {quote && (
        <Dialog
          title="Cobrar y registrar salida"
          busy={busy}
          onClose={() => {
            setQuote(null);
            clearError();
          }}
        >
          <PaymentPanel
            quote={quote}
            now={now}
            hasShift={!!data?.shift}
            blocked={!!loadError}
            busy={busy}
            error={actionError ?? loadError}
            onPay={pay}
            onRefresh={() => {
              void charge(quote.stay.id);
            }}
            openCash={openCash}
          />
        </Dialog>
      )}
      {receipt && (
        <Dialog
          title={receipt.kind === 'entry' ? 'Recibo de entrada' : 'Comprobante de pago'}
          className="receipt-dialog"
          onClose={() => setReceipt(null)}
        >
          <ReceiptPanel value={receipt} />
        </Dialog>
      )}
      {destination && (
        <Dialog title="Tienes cambios sin guardar" onClose={() => setDestination(null)}>
          <p className="dialog-description">
            Puedes seguir editando las tarifas o salir y descartar los cambios de este formulario.
          </p>
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setDestination(null)}>
              Seguir editando
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDirty(false);
                setSection(destination);
                setDestination(null);
                clearError();
              }}
            >
              Descartar y salir
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
