import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  Bike,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Printer,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import type { EntryInput, ParkingState, Stay, VehicleType } from '../../domain/parking-types';
import { Button, EmptyState, Notice, Panel, SectionTitle } from './ui';
import { dateTime, duration, methods, money } from './format.mjs';
import { EntryForm } from './entry-form';

export function Operation({
  data,
  now,
  busy,
  offline,
  onEnter,
  onCharge,
  onEntryReceipt,
  onPaymentReceipt,
  openCash,
  openReports,
}: {
  data: ParkingState;
  now: number;
  busy: boolean;
  offline: boolean;
  onEnter: (input: EntryInput) => Promise<boolean>;
  onCharge: (id: string) => void;
  onEntryReceipt: (stay: Stay) => void;
  onPaymentReceipt: (id: string) => void;
  openCash: () => void;
  openReports: () => void;
}) {
  const [filter, setFilter] = useState<VehicleType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<'present' | 'entry'>('present');
  const [seed, setSeed] = useState({ plate: '', revision: 0 });
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if (
        e.key !== '/' ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e.target instanceof HTMLElement &&
          (e.target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)))
      )
        return;
      e.preventDefault();
      setMode('present');
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);
  const cars = data.active.filter((s) => s.type === 'car').length;
  const motos = data.active.length - cars;
  const matches = data.active
    .filter(
      (s) =>
        (filter === 'all' || filter === s.type) && s.plate.includes(search.replace(/[\s-]/g, '')),
    )
    .sort((a, b) => a.entry_at - b.entry_at);
  const pages = Math.max(1, Math.ceil(matches.length / 20));
  const currentPage = Math.min(page, pages);
  const list = matches.slice((currentPage - 1) * 20, currentPage * 20);
  const today = data.today.reduce((a, p) => a + p.total, 0);
  return (
    <>
      <div className="operation-status">
        <div className="presence">
          <strong>{data.active.length}</strong>
          <span>vehículos presentes</span>
          <span className="type-count">
            <Car size={16} />
            {cars}
          </span>
          <span className="type-count">
            <Bike size={16} />
            {motos}
          </span>
        </div>
        <div className="shift-chip">
          <i className={data.shift ? 'status-dot' : 'status-dot status-muted'} />
          <span>{data.shift ? 'Caja abierta' : 'Caja cerrada'}</span>
          <button type="button" onClick={openCash}>
            {data.shift ? `Efectivo ${money(data.shift.current_expected)}` : 'Abrir turno'}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
      {!data.shift && (
        <Notice tone="warning">
          <Wallet size={18} />
          <div>
            <strong>Abre caja para registrar cobros.</strong>
            <p>Puedes seguir recibiendo vehículos mientras la caja está cerrada.</p>
          </div>
          <Button variant="quiet" onClick={openCash}>
            Ir a caja
            <ArrowRight size={16} />
          </Button>
        </Notice>
      )}
      <div className="mobile-work-mode" aria-label="Tarea de operación">
        <Button
          variant={mode === 'present' ? 'primary' : 'secondary'}
          onClick={() => setMode('present')}
        >
          Buscar salida
        </Button>
        <Button
          variant={mode === 'entry' ? 'primary' : 'secondary'}
          onClick={() => setMode('entry')}
        >
          <ArrowDownLeft size={17} />
          Nueva entrada
        </Button>
      </div>
      <div className={`operation-layout mode-${mode}`}>
        <div className="present-column">
          <Panel>
            <SectionTitle
              title="Vehículos en parqueadero"
              description="Busca la placa y consulta el valor de salida."
              action={
                <span className="live-caption">
                  <span className="status-dot" />
                  Actualización automática
                </span>
              }
            />
            <form
              className="plate-search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                if (matches.length === 1 && !busy && !offline) onCharge(matches[0].id);
              }}
            >
              <Search size={21} aria-hidden="true" />
              <input
                ref={searchRef}
                aria-label="Buscar placa para cobrar"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value.toUpperCase());
                  setPage(1);
                }}
                placeholder="Buscar placa para cobrar"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd aria-hidden="true">/</kbd>
              {search && (
                <Button
                  variant="quiet"
                  aria-label="Limpiar búsqueda"
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                    searchRef.current?.focus();
                  }}
                >
                  <X size={16} />
                </Button>
              )}
            </form>
            <div className="list-toolbar">
              <div className="filter-tabs" aria-label="Filtrar vehículos">
                {(
                  [
                    ['all', 'Todos', data.active.length],
                    ['car', 'Carros', cars],
                    ['motorcycle', 'Motos', motos],
                  ] as const
                ).map(([value, label, count]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={filter === value}
                    className={filter === value ? 'active' : ''}
                    onClick={() => {
                      setFilter(value);
                      setPage(1);
                    }}
                  >
                    {label}
                    <span>{count}</span>
                  </button>
                ))}
              </div>
              <span className="muted small">Más antiguos primero</span>
            </div>
            {list.length ? (
              <div className="table-scroll">
                <table className="stays-table">
                  <thead>
                    <tr>
                      <th>Vehículo</th>
                      <th>Ingreso</th>
                      <th>Tiempo</th>
                      <th>Estimado</th>
                      <th>
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="vehicle">
                            <span className={`vehicle-icon ${s.type}`}>
                              {s.type === 'car' ? <Car size={21} /> : <Bike size={21} />}
                            </span>
                            <div>
                              <strong className="plate">{s.plate}</strong>
                              <small>
                                {s.type === 'car' ? 'Carro' : 'Moto'}
                                <span className="compact-duration">
                                  {' '}
                                  · {duration((now - s.entry_at) / 60000)}
                                </span>
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>{dateTime(s.entry_at)}</td>
                        <td>
                          <span className="elapsed">
                            <Clock3 size={13} />
                            {duration((now - s.entry_at) / 60000)}
                          </span>
                          {now - s.entry_at > 86400000 && (
                            <small className="long-stay">Más de un día</small>
                          )}
                        </td>
                        <td className="amount">{money(s.estimate.total)}</td>
                        <td>
                          <div className="row-actions">
                            <Button
                              variant="quiet"
                              aria-label={`Recibo de entrada ${s.plate}`}
                              onClick={() => onEntryReceipt(s)}
                            >
                              <Printer size={16} />
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={busy || offline}
                              onClick={() => onCharge(s.id)}
                              aria-label={`Cobrar ${s.plate}`}
                            >
                              Cobrar
                              <ArrowRight size={15} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={<Search size={26} />}
                title={
                  search
                    ? `No hay una estadía activa para ${search}`
                    : 'No hay vehículos en este filtro'
                }
                description={
                  search
                    ? 'Comprueba la placa. Si el vehículo está llegando, registra una entrada.'
                    : data.active.length
                      ? 'Prueba con otro tipo de vehículo.'
                      : 'Registra el primer ingreso desde el formulario de entrada.'
                }
                action={
                  search ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSeed((previous) => ({ plate: search, revision: previous.revision + 1 }));
                        setMode('entry');
                      }}
                    >
                      Registrar entrada con esta placa
                      <ArrowRight size={15} />
                    </Button>
                  ) : undefined
                }
              />
            )}
            <div className="list-footer">
              <span>
                {matches.length
                  ? `${(currentPage - 1) * 20 + 1}–${Math.min(currentPage * 20, matches.length)} de ${matches.length}`
                  : 'Sin estadías activas'}{' '}
                · Tarifa conservada al ingreso
              </span>
              {pages > 1 && (
                <div>
                  <Button
                    variant="quiet"
                    aria-label="Página anterior"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <span>
                    {currentPage}/{pages}
                  </span>
                  <Button
                    variant="quiet"
                    aria-label="Página siguiente"
                    disabled={currentPage === pages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              )}
            </div>
          </Panel>
          <Panel className="recent-payments">
            <SectionTitle
              title="Últimos cobros"
              description={`Recaudo de hoy: ${money(today)} · Todos los medios`}
              action={
                <Button variant="quiet" onClick={openReports}>
                  Ver reportes
                  <ArrowRight size={15} />
                </Button>
              }
            />
            {data.recent.length ? (
              <div className="recent-list">
                {data.recent.slice(0, 5).map((p) => (
                  <div className="recent-row" key={p.id}>
                    <div>
                      <strong className="plate">{p.plate}</strong>
                      <small>
                        {dateTime(p.paid_at)} · {methods[p.method]}
                      </small>
                    </div>
                    <strong className="amount">{money(p.total)}</strong>
                    <Button
                      variant="quiet"
                      aria-label={`Ver comprobante ${p.plate}`}
                      onClick={() => onPaymentReceipt(p.id)}
                    >
                      <Printer size={17} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="inline-empty">
                Los pagos confirmados aparecerán aquí con su comprobante.
              </p>
            )}
          </Panel>
        </div>
        <aside className="entry-column">
          <Panel>
            <div className="entry-panel-heading">
              <span>
                <ArrowDownLeft size={21} />
              </span>
              <div>
                <h2>Registrar entrada</h2>
                <p>Placa, tipo y estado del vehículo.</p>
              </div>
            </div>
            <EntryForm
              key={seed.revision}
              config={data.config}
              busy={busy}
              disabled={busy || offline}
              focused={mode === 'entry'}
              initialPlate={seed.plate}
              onEnter={onEnter}
            />
          </Panel>
          <div className="operator-note">
            <Clock3 size={16} />
            <p>El valor de salida se liquida con la tarifa que tenía el vehículo al ingresar.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
