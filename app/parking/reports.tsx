import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, BarChart3, ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react';
import { bogotaDay } from '../../domain/billing.mjs';
import type { Report } from '../../domain/parking-types';
import { fetchReport } from './api';
import { Button, EmptyState, ErrorNotice, Field, Metric, Panel, SectionTitle } from './ui';
import { dateTime, downloadReport, methods, money, vehicleNames } from './format.mjs';

export function Reports({ now, onReceipt }: { now: number; onReceipt: (id: string) => void }) {
  const id = useId();
  const today = bogotaDay(now);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const load = async (start = from, end = to) => {
    const generation = ++request.current;
    setBusy(true);
    setError(null);
    try {
      const result = await fetchReport(start, end);
      if (generation === request.current) {
        setReport(result);
        setPage(1);
      }
    } catch (e) {
      if (generation === request.current)
        setError(e instanceof Error ? e : new Error('No pudimos cargar el reporte.'));
    } finally {
      if (generation === request.current) setBusy(false);
    }
  };
  const choose = (start: string, end: string) => {
    setFrom(start);
    setTo(end);
    void load(start, end);
  };
  const rows = report?.rows.slice((page - 1) * 25, page * 25) ?? [];
  const pages = Math.max(1, Math.ceil((report?.rows.length ?? 0) / 25));
  return (
    <>
      <Panel className="report-controls">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <Field id={`${id}-from`} label="Desde">
            <input
              id={`${id}-from`}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              required
            />
          </Field>
          <Field id={`${id}-to`} label="Hasta">
            <input
              id={`${id}-to`}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" busy={busy}>
            Consultar período
            <ArrowRight size={16} />
          </Button>
        </form>
        <div className="report-shortcuts">
          <span>Consulta rápida</span>
          <Button variant="quiet" disabled={busy} onClick={() => choose(today, today)}>
            Hoy
          </Button>
          <Button
            variant="quiet"
            disabled={busy}
            onClick={() =>
              choose(bogotaDay(Date.parse(`${today}T12:00:00-05:00`) - 6 * 86400000), today)
            }
          >
            Últimos 7 días
          </Button>
          <Button
            variant="quiet"
            disabled={busy}
            onClick={() => choose(`${today.slice(0, 8)}01`, today)}
          >
            Este mes
          </Button>
          <small>Fecha de pago · Colombia · Hasta 93 días</small>
        </div>
      </Panel>
      <ErrorNotice
        error={error}
        onRetry={() => {
          void load();
        }}
      />
      {report ? (
        <>
          <div className="report-heading">
            <div>
              <span className="eyebrow">Resumen del período</span>
              <h2>
                {report.from} <span>→</span> {report.to}
              </h2>
              {(from !== report.from || to !== report.to) && (
                <p className="draft-query">
                  Cambiaste las fechas. Pulsa Consultar período para aplicarlas.
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              disabled={!report.rows.length}
              onClick={() => downloadReport(report)}
            >
              <Download size={16} />
              Exportar período
            </Button>
          </div>
          <div className="report-metrics">
            <Metric
              label="Total recaudado"
              value={money(report.totals.total)}
              detail={`${report.rows.length} pagos confirmados`}
            />
            {(['cash', 'transfer', 'card'] as const).map((m) => (
              <Metric
                key={m}
                label={methods[m]}
                value={money(report.totals[m])}
                detail={`${report.rows.filter((r) => r.method === m).length} pagos`}
              />
            ))}
          </div>
          <Panel>
            <SectionTitle
              title="Detalle de pagos"
              description="Cada fila corresponde a un pago confirmado y su salida."
            />
            {rows.length ? (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Vehículo</th>
                        <th>Ingreso</th>
                        <th>Salida</th>
                        <th>Medio</th>
                        <th>Total</th>
                        <th>
                          <span className="sr-only">Comprobante</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong className="plate">{r.plate}</strong>
                            <small>{vehicleNames[r.type]}</small>
                          </td>
                          <td>{dateTime(r.entry_at)}</td>
                          <td>{dateTime(r.exit_at)}</td>
                          <td>{methods[r.method]}</td>
                          <td className="amount">{money(r.total)}</td>
                          <td>
                            <Button
                              variant="quiet"
                              aria-label={`Comprobante ${r.plate}`}
                              onClick={() => onReceipt(r.id)}
                            >
                              <Printer size={17} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="list-footer">
                  <span>
                    {(page - 1) * 25 + 1}–{Math.min(page * 25, report.rows.length)} de{' '}
                    {report.rows.length} pagos
                  </span>
                  <div>
                    <Button
                      variant="quiet"
                      aria-label="Pagos anteriores"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <span>
                      {page}/{pages}
                    </span>
                    <Button
                      variant="quiet"
                      aria-label="Pagos siguientes"
                      disabled={page === pages}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                icon={<BarChart3 size={27} />}
                title="Sin pagos en este período"
                description="Prueba otras fechas. Las estadías activas aparecerán cuando registres su pago y salida."
              />
            )}
          </Panel>
        </>
      ) : (
        <Panel>
          <EmptyState
            icon={<BarChart3 size={28} />}
            title="Consulta la operación por fechas"
            description="Elige un período o usa una consulta rápida para revisar los pagos y descargar su detalle."
          />
        </Panel>
      )}
    </>
  );
}
