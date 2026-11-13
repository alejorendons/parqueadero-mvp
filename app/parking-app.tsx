'use client';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Car,
  Bike,
  LayoutDashboard,
  Wallet,
  BarChart3,
  Settings,
  Plus,
  Search,
  ArrowRight,
  RefreshCw,
  X,
  Printer,
  Download,
  Check,
  Clock3,
  MapPin,
  LogOut,
  ShieldCheck,
  CircleParking,
} from 'lucide-react';
import { bogotaDay } from '../domain/billing.mjs';

type Row = Record<string, any>;
type Screen = 'operation' | 'cash' | 'reports' | 'settings';
const cop = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);
const date = (n: number) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(n);
const time = (n: number) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(n);
const duration = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
const methodName: Row = { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta' };
async function api(body?: Row, query = ''): Promise<Row> {
  const response = await fetch(
    `/api/parking${query}`,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Parking-Request': '1' },
          body: JSON.stringify(body),
        }
      : { cache: 'no-store' },
  );
  let data: Row;
  try {
    data = (await response.json()) as Row;
  } catch {
    throw new Error('El servidor no respondió. Revisa la conexión y actualiza.');
  }
  if (!response.ok) throw new Error(data.error ?? 'No se pudo completar la operación.');
  return data;
}
const formValues = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget));
};

function Modal({
  title,
  children,
  onClose,
  busy,
  error,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
  error: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Cerrar ventana"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {children}
    </dialog>
  );
}
function Empty({
  title,
  text,
  icon = <Car size={27} />,
}: {
  title: string;
  text: string;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-label">
        {label}
        <span>{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function EntryForm({
  busy,
  onEnter,
  config,
}: {
  busy: boolean;
  onEnter: (data: Row, form: HTMLFormElement) => void;
  config: Row;
}) {
  const fieldId = useId();
  const [type, setType] = useState('car');
  const rate = config.rates[type];
  return (
    <form
      onSubmit={(e) => {
        const f = e.currentTarget;
        onEnter({ ...formValues(e), type }, f);
      }}
      className="entry-form"
    >
      <fieldset className="vehicle-fieldset">
        <legend>Tipo de vehículo</legend>
        <div className="vehicle-toggle">
          <button
            type="button"
            className={type === 'car' ? 'selected' : ''}
            onClick={() => setType('car')}
            aria-pressed={type === 'car'}
          >
            <Car size={22} />
            Carro
          </button>
          <button
            type="button"
            className={type === 'motorcycle' ? 'selected' : ''}
            onClick={() => setType('motorcycle')}
            aria-pressed={type === 'motorcycle'}
          >
            <Bike size={22} />
            Moto
          </button>
        </div>
      </fieldset>
      <label htmlFor={`${fieldId}-plate`}>Placa del vehículo</label>
      <input
        id={`${fieldId}-plate`}
        name="plate"
        className="plate-input"
        autoComplete="off"
        placeholder={type === 'car' ? 'ABC123' : 'ABC12D'}
        maxLength={9}
        required
        aria-describedby={`${fieldId}-hint`}
      />
      <small id={`${fieldId}-hint`}>
        Sin espacios ni guiones. {type === 'car' ? 'Ejemplo: ABC123' : 'Ejemplo: ABC12D o ABC12'}
      </small>
      <label htmlFor={`${fieldId}-state`}>Estado y observaciones</label>
      <textarea
        id={`${fieldId}-state`}
        name="vehicleState"
        maxLength={500}
        required
        placeholder="Ej.: sin daños visibles; objetos declarados…"
        rows={2}
      />
      <div className="rate-box">
        <Clock3 size={17} />
        <div>
          <b>
            {cop(rate.blockPrice)} /{' '}
            {rate.blockMinutes === 60 ? 'hora' : `${rate.blockMinutes} min`} o fracción
          </b>
          <small>
            {rate.graceMinutes ? `Tolerancia: ${rate.graceMinutes} min` : 'Sin tolerancia gratuita'}{' '}
            · Tarifa al ingreso
          </small>
        </div>
      </div>
      <button type="submit" className="primary full" disabled={busy}>
        <ArrowDownLeft size={18} />
        Registrar entrada
        <ArrowRight size={18} />
      </button>
      <p className="form-foot">
        <ShieldCheck size={14} />
        La hora se registra automáticamente.
      </p>
    </form>
  );
}

function Receipt({ value }: { value: Row }) {
  const { stay, payment, quote } = value;
  const config = stay.business;
  const rate = stay.rate;
  return (
    <div className="receipt">
      <div className="receipt-logo">
        <CircleParking size={30} />
      </div>
      <h3>{config.name}</h3>
      <p>
        {config.city}
        {config.address ? ` · ${config.address}` : ''}
      </p>
      {config.nit && <p>NIT {config.nit}</p>}
      <hr />
      <small>{payment ? 'COMPROBANTE DE PAGO' : 'RECIBO DE ENTRADA'}</small>
      <h2 className="receipt-plate">{stay.plate}</h2>
      <p>
        {stay.type === 'car' ? 'Carro' : 'Moto'} · #{stay.id.slice(0, 8).toUpperCase()}
      </p>
      <dl>
        <dt>Entrada</dt>
        <dd>{date(stay.entry_at)}</dd>
        {payment && (
          <>
            <dt>Salida</dt>
            <dd>{date(stay.exit_at)}</dd>
          </>
        )}
        <dt>Tarifa</dt>
        <dd>
          {cop(rate.blockPrice)} / {rate.blockMinutes} min o fracción
        </dd>
        <dt>Tolerancia</dt>
        <dd>{rate.graceMinutes} min</dd>
      </dl>
      <p className="receipt-notes">
        <b>Estado declarado:</b> {stay.vehicle_state}
      </p>
      {payment && (
        <>
          <hr />
          <dl>
            <dt>Bloques cobrados</dt>
            <dd>{quote.blocks}</dd>
            <dt>Liquidado a las</dt>
            <dd>{time(quote.quoted_at)}</dd>
            <dt>Medio de pago</dt>
            <dd>{methodName[payment.method]}</dd>
            <dt>Recibido</dt>
            <dd>{cop(payment.tendered)}</dd>
            <dt>Cambio</dt>
            <dd>{cop(payment.change)}</dd>
          </dl>
          <div className="receipt-total">
            <span>Total pagado</span>
            <strong>{cop(payment.total)}</strong>
          </div>
          <small>Pago #{payment.id.slice(0, 8).toUpperCase()}</small>
        </>
      )}
      {(config.insurer || config.policy) && (
        <p className="receipt-notes">
          Aseguradora: {config.insurer || 'Pendiente'} · Póliza: {config.policy || 'Pendiente'}
        </p>
      )}
      {config.claims && <p className="receipt-notes">Reclamaciones: {config.claims}</p>}
      <hr />
      <p>Conserva este comprobante.</p>
      <small>Documento operativo. No es factura electrónica.</small>
    </div>
  );
}

export default function ParkingApp({
  operator,
  initialNow,
}: {
  operator: string;
  initialNow: number;
}) {
  const [screen, setScreen] = useState<Screen>('operation');
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [connected, setConnected] = useState(true);
  const [tick, setTick] = useState(initialNow);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [entryModal, setEntryModal] = useState(false);
  const [quote, setQuote] = useState<Row | null>(null);
  const [receipt, setReceipt] = useState<Row | null>(null);
  const [method, setMethod] = useState('cash');
  const [tendered, setTendered] = useState('');
  const [closeConfirm, setCloseConfirm] = useState<Row | null>(null);
  const [from, setFrom] = useState(bogotaDay());
  const [to, setTo] = useState(bogotaDay());
  const [report, setReport] = useState<Row | null>(null);
  const refresh = useCallback(async () => {
    try {
      const d = await api();
      setData(d);
      setOffset(d.now - Date.now());
      setConnected(true);
    } catch (e) {
      setConnected(false);
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const a = setInterval(() => {
      void refresh();
    }, 15000);
    const b = setInterval(() => setTick(Date.now()), 1000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const run = async (body: Row, success?: (d: Row) => void) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const d = await api(body);
      success?.(d);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const enter = (body: Row, form: HTMLFormElement) =>
    void run({ action: 'enter', ...body }, (stay) => {
      form.reset();
      setEntryModal(false);
      setReceipt({ stay });
      setToast(`Entrada registrada: ${stay.plate}`);
    });
  const getQuote = (stayId: string) =>
    void run({ action: 'quote', stayId }, (q) => {
      setQuote(q);
      setMethod('cash');
      setTendered(String(q.total));
    });
  const viewReceipt = async (id: string) => {
    try {
      setReceipt(await api(undefined, `?action=receipt&id=${encodeURIComponent(id)}`));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const loadReport = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busyRef.current) return;
    setBusy(true);
    busyRef.current = true;
    setError('');
    try {
      setReport(await api(undefined, `?action=report&from=${from}&to=${to}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };
  const csv = () => {
    if (!report) return;
    const rows = [
      [
        'Pago',
        'Placa',
        'Vehículo',
        'Entrada Colombia',
        'Salida Colombia',
        'Medio',
        'Total COP',
        'Recibido COP',
        'Cambio COP',
        'Caja',
      ],
      ...report.rows.map((r: Row) => [
        r.id,
        r.plate,
        r.type === 'car' ? 'Carro' : 'Moto',
        date(r.entry_at),
        date(r.exit_at),
        methodName[r.method],
        r.total,
        r.tendered,
        r.change,
        r.shift_id,
      ]),
    ];
    const escape = (s: unknown) => `"${String(s).replaceAll('"', '""')}"`;
    const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(escape).join(';')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagos-${report.from}-${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const nav: { id: Screen; label: string; icon: ReactNode }[] = [
    { id: 'operation', label: 'Operación', icon: <LayoutDashboard size={19} /> },
    { id: 'cash', label: 'Caja', icon: <Wallet size={19} /> },
    { id: 'reports', label: 'Reportes', icon: <BarChart3 size={19} /> },
    { id: 'settings', label: 'Configuración', icon: <Settings size={19} /> },
  ];
  const titles: Row = {
    operation: ['Todo en su lugar.', 'Registra entradas y gestiona las salidas de tu parqueadero.'],
    cash: ['Tu caja, al día.', 'Controla el efectivo y cierra cada turno con claridad.'],
    reports: ['Las cuentas claras.', 'Consulta pagos y exporta la operación por fechas.'],
    settings: ['A tu manera.', 'Configura tu parqueadero y las tarifas para nuevas entradas.'],
  };
  const now = tick + offset;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Parqueo inicio">
          <span>
            P<span className="brand-dot">.</span>
          </span>
          <b>
            parqueo<span>CONTROL DE PARQUEADERO</span>
          </b>
        </a>
        <div className="location-card">
          <div className="location-icon">
            <MapPin size={19} />
          </div>
          <div>
            <b>{data?.config.name ?? 'Mi parqueadero'}</b>
            <small>{data?.config.city ?? 'El Retiro, Antioquia'}</small>
          </div>
        </div>
        <p className="nav-label">ADMINISTRACIÓN</p>
        <nav>
          {nav.map((n) => (
            <button
              type="button"
              key={n.id}
              className={screen === n.id ? 'active' : ''}
              onClick={() => {
                setScreen(n.id);
                setError('');
              }}
            >
              {n.icon}
              {n.label}
              {n.id === 'operation' && data && (
                <span className="nav-count">{data.active.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="private-tag">
            <ShieldCheck size={15} />
            Espacio privado
          </span>
          <div className="user">
            <span className="avatar">{operator.slice(0, 1).toUpperCase()}</span>
            <div>
              <b>Administrador</b>
              <small title={operator}>{operator}</small>
            </div>
            <a href="/signout-with-chatgpt?return_to=/" target="_top" aria-label="Cerrar sesión">
              <LogOut size={17} />
            </a>
          </div>
          <p>PARQUEO · MVP 1.0</p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="crumb">Mi parqueadero</span>
            <span className="crumb-slash">/</span>
            <b>{nav.find((n) => n.id === screen)?.label}</b>
          </div>
          <div className="topbar-right">
            <span className={`connection ${connected ? '' : 'offline'}`}>
              <i />
              {connected ? 'Conectado' : 'Sin conexión'}
            </span>
            <span className="live-clock">
              {time(now)} <small>COL</small>
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label="Actualizar datos"
              onClick={refresh}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {new Intl.DateTimeFormat('es-CO', {
                  timeZone: 'America/Bogota',
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                }).format(now)}
              </p>
              <h1>{titles[screen][0]}</h1>
              <p>{titles[screen][1]}</p>
            </div>
            {screen === 'operation' && (
              <button
                type="button"
                className="primary"
                onClick={() => setEntryModal(true)}
                disabled={!data || busy}
              >
                <Plus size={18} />
                Nueva entrada
              </button>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              <span>{error}</span>
              <button
                type="button"
                className="icon-button"
                aria-label="Cerrar aviso"
                onClick={() => setError('')}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {!data ? (
            <section className="panel">
              <Empty
                title={connected ? 'Cargando tu parqueadero…' : 'No pudimos cargar los datos'}
                text="Si tarda más de lo esperado, comprueba la conexión y pulsa actualizar."
                icon={<RefreshCw size={25} />}
              />
              <button type="button" className="secondary center" onClick={refresh}>
                Actualizar
              </button>
            </section>
          ) : (
            <>
              {!data.shift && screen === 'operation' && (
                <div className="notice">
                  <Wallet size={18} />
                  <span>
                    <b>La caja está cerrada.</b> Puedes registrar entradas. Para cobrar, abre un
                    turno.
                  </span>
                  <button type="button" onClick={() => setScreen('cash')}>
                    Abrir caja
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
              {screen === 'operation' && (
                <>
                  <div className="stats">
                    <Stat
                      label="Vehículos en parqueadero"
                      value={data.active.length}
                      hint="Estadías activas en este momento"
                      icon={<CircleParking size={18} />}
                    />
                    <Stat
                      label="Carros"
                      value={data.active.filter((s: Row) => s.type === 'car').length}
                      hint="Dentro del parqueadero"
                      icon={<Car size={19} />}
                    />
                    <Stat
                      label="Motos"
                      value={data.active.filter((s: Row) => s.type === 'motorcycle').length}
                      hint="Dentro del parqueadero"
                      icon={<Bike size={19} />}
                    />
                    <Stat
                      label="Recaudado hoy"
                      value={cop(data.today.reduce((n: number, r: Row) => n + r.total, 0))}
                      hint={`${data.today.reduce((n: number, r: Row) => n + r.count, 0)} pagos registrados · Todos los medios`}
                      icon={<Wallet size={18} />}
                    />
                  </div>
                  <div className="operation-grid">
                    <div>
                      <section className="panel">
                        <div className="panel-title">
                          <div>
                            <h2>
                              Estadías activas <span className="count">{data.active.length}</span>
                            </h2>
                            <p>Busca una placa para consultar y cobrar la salida.</p>
                          </div>
                          <span className="live-tag">
                            <i aria-hidden="true" /> En vivo
                          </span>
                        </div>
                        <div className="table-tools">
                          <div className="search">
                            <Search size={18} />
                            <input
                              aria-label="Buscar placa"
                              placeholder="Buscar por placa…"
                              value={search}
                              onChange={(e) => setSearch(e.target.value.toUpperCase())}
                            />
                          </div>
                          <div className="filters">
                            {[
                              ['all', 'Todos'],
                              ['car', 'Carros'],
                              ['motorcycle', 'Motos'],
                            ].map(([v, l]) => (
                              <button
                                type="button"
                                key={v}
                                className={filter === v ? 'selected' : ''}
                                onClick={() => setFilter(v)}
                              >
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                        {(() => {
                          const list = data.active.filter(
                            (s: Row) =>
                              s.plate.includes(search.replace(/[\s-]/g, '')) &&
                              (filter === 'all' || s.type === filter),
                          );
                          return list.length ? (
                            <div className="table-scroll">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Vehículo</th>
                                    <th>Entrada</th>
                                    <th>Estadía</th>
                                    <th>Estimado</th>
                                    <th>
                                      <span className="sr-only">Acciones</span>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {list.map((s: Row) => (
                                    <tr key={s.id}>
                                      <td>
                                        <div className="vehicle-cell">
                                          <span className={`vehicle-icon ${s.type}`}>
                                            {s.type === 'car' ? (
                                              <Car size={20} />
                                            ) : (
                                              <Bike size={20} />
                                            )}
                                          </span>
                                          <div>
                                            <b className="plate">{s.plate}</b>
                                            <small>{s.type === 'car' ? 'Carro' : 'Moto'}</small>
                                          </div>
                                        </div>
                                      </td>
                                      <td>{date(s.entry_at)}</td>
                                      <td>
                                        <span className="duration">
                                          <Clock3 size={13} />
                                          {duration(
                                            Math.max(0, Math.ceil((now - s.entry_at) / 60000)),
                                          )}
                                        </span>
                                      </td>
                                      <td className="money">
                                        {cop(s.estimate.total)}
                                        <small>Consultar para liquidar</small>
                                      </td>
                                      <td>
                                        <button
                                          type="button"
                                          className="text-button"
                                          disabled={busy}
                                          onClick={() => getQuote(s.id)}
                                        >
                                          Cobrar
                                          <ArrowUpRight size={16} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <Empty
                              title={
                                data.active.length
                                  ? 'No encontramos esa placa'
                                  : 'Listo para recibir vehículos'
                              }
                              text={
                                data.active.length
                                  ? 'Revisa la búsqueda o cambia el filtro.'
                                  : 'Registra la primera entrada. Aquí verás las estadías y su valor estimado.'
                              }
                            />
                          );
                        })()}
                        <div className="panel-footer">
                          Hora de Colombia · Las tarifas se conservan desde el ingreso.
                        </div>
                      </section>
                      <section className="panel recent-panel">
                        <div className="panel-title">
                          <div>
                            <h2>Últimas salidas</h2>
                            <p>Pagos confirmados y comprobantes disponibles.</p>
                          </div>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => setScreen('reports')}
                          >
                            Ver reportes
                            <ArrowRight size={16} />
                          </button>
                        </div>
                        {data.recent.length ? (
                          <div className="table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>Placa</th>
                                  <th>Salida</th>
                                  <th>Medio</th>
                                  <th>Total</th>
                                  <th>Recibo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.recent.slice(0, 5).map((p: Row) => (
                                  <tr key={p.id}>
                                    <td className="plate">{p.plate}</td>
                                    <td>{date(p.paid_at)}</td>
                                    <td>{methodName[p.method]}</td>
                                    <td className="money">{cop(p.total)}</td>
                                    <td>
                                      <button
                                        type="button"
                                        className="icon-button"
                                        aria-label={`Ver recibo de ${p.plate}`}
                                        onClick={() => viewReceipt(p.id)}
                                      >
                                        <Printer size={17} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="simple-empty">
                            Las salidas aparecerán aquí después del primer cobro.
                          </div>
                        )}
                      </section>
                    </div>
                    <aside className="entry-column">
                      <section className="panel entry-panel">
                        <div className="entry-head">
                          <span>
                            <ArrowDownLeft size={20} />
                          </span>
                          <div>
                            <h2>Registrar entrada</h2>
                            <p>Un nuevo vehículo, en segundos.</p>
                          </div>
                        </div>
                        <EntryForm busy={busy} onEnter={enter} config={data.config} />
                      </section>
                      <div className="tip">
                        <div className="tip-icon">
                          <ShieldCheck size={20} />
                        </div>
                        <h3>Cada movimiento cuenta.</h3>
                        <p>Entradas, pagos y cierres quedan registrados con fecha y operador.</p>
                        <span>
                          Una operación más tranquila
                          <ArrowRight size={16} />
                        </span>
                      </div>
                    </aside>
                  </div>
                </>
              )}
              {screen === 'cash' && (
                <>
                  <div className="stats three">
                    <Stat
                      label="Estado del turno"
                      value={data.shift ? 'Caja abierta' : 'Caja cerrada'}
                      hint={
                        data.shift
                          ? `Desde ${date(data.shift.opened_at)}`
                          : 'Abre un turno para comenzar a cobrar'
                      }
                      icon={<Wallet size={18} />}
                    />
                    <Stat
                      label="Efectivo esperado"
                      value={cop(data.shift?.current_expected ?? 0)}
                      hint="Base + pagos en efectivo + movimientos"
                      icon={<ArrowDownLeft size={18} />}
                    />
                    <Stat
                      label="Base inicial"
                      value={cop(data.shift?.opening ?? 0)}
                      hint="Fondo de cambio al abrir el turno"
                      icon={<CircleParking size={18} />}
                    />
                  </div>
                  <div className="two-columns">
                    {!data.shift ? (
                      <section className="panel padded">
                        <h2>Abrir caja</h2>
                        <p className="muted">Cuenta el dinero disponible para dar cambio.</p>
                        <form
                          className="stack"
                          onSubmit={(e) => {
                            const v = formValues(e);
                            void run({ action: 'openShift', opening: Number(v.opening) }, () =>
                              setToast('Caja abierta. Ya puedes cobrar.'),
                            );
                          }}
                        >
                          <label htmlFor="opening">Base inicial en COP</label>
                          <input
                            id="opening"
                            name="opening"
                            type="number"
                            min="0"
                            max="100000000"
                            step="1"
                            required
                            placeholder="50000"
                          />
                          <button type="submit" className="primary" disabled={busy}>
                            Abrir turno
                            <ArrowRight size={18} />
                          </button>
                        </form>
                      </section>
                    ) : (
                      <>
                        <section className="panel padded">
                          <h2>Movimiento de efectivo</h2>
                          <p className="muted">
                            Registra ingresos adicionales o retiros con su motivo.
                          </p>
                          <form
                            className="stack"
                            onSubmit={(e) => {
                              const form = e.currentTarget;
                              const v = formValues(e);
                              void run(
                                {
                                  action: 'move',
                                  shiftId: data.shift.id,
                                  direction: v.direction,
                                  amount: Number(v.amount),
                                  reason: v.reason,
                                },
                                () => {
                                  form.reset();
                                  setToast('Movimiento registrado.');
                                },
                              );
                            }}
                          >
                            <label htmlFor="direction">Tipo</label>
                            <select id="direction" name="direction">
                              <option value="out">Retiro de efectivo</option>
                              <option value="in">Ingreso de efectivo</option>
                            </select>
                            <label htmlFor="movement-amount">Valor en COP</label>
                            <input
                              id="movement-amount"
                              name="amount"
                              type="number"
                              min="1"
                              max="100000000"
                              step="1"
                              required
                            />
                            <label htmlFor="movement-reason">Motivo</label>
                            <input
                              id="movement-reason"
                              name="reason"
                              maxLength={200}
                              required
                              placeholder="Ej.: retiro para consignación"
                            />
                            <button type="submit" className="primary" disabled={busy}>
                              Registrar movimiento
                            </button>
                          </form>
                        </section>
                        <section className="panel padded">
                          <h2>Cerrar turno</h2>
                          <p className="muted">
                            Cuenta únicamente el efectivo físico. Los pagos digitales se reportan
                            aparte.
                          </p>
                          <form
                            className="stack"
                            onSubmit={(e) => {
                              const v = formValues(e);
                              setCloseConfirm({
                                shiftId: data.shift.id,
                                counted: Number(v.counted),
                                note: v.note,
                              });
                            }}
                          >
                            <label htmlFor="counted">Efectivo contado en COP</label>
                            <input
                              id="counted"
                              name="counted"
                              type="number"
                              min="0"
                              max="100000000"
                              step="1"
                              required
                            />
                            <label htmlFor="close-note">Observaciones del cierre</label>
                            <textarea
                              id="close-note"
                              name="note"
                              maxLength={300}
                              rows={3}
                              placeholder="Explica cualquier diferencia…"
                            />
                            <button type="submit" className="secondary" disabled={busy}>
                              Revisar cierre
                              <ArrowRight size={17} />
                            </button>
                          </form>
                        </section>
                      </>
                    )}
                  </div>
                  {data.movements.length > 0 && (
                    <section className="panel recent-panel">
                      <div className="panel-title">
                        <h2>Movimientos del turno</h2>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Hora</th>
                              <th>Motivo</th>
                              <th>Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.movements.map((m: Row) => (
                              <tr key={m.id}>
                                <td>{date(m.at)}</td>
                                <td>{m.reason}</td>
                                <td className={m.amount < 0 ? 'negative money' : 'positive money'}>
                                  {cop(m.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                  <section className="panel recent-panel">
                    <div className="panel-title">
                      <h2>Historial de turnos</h2>
                      <span className="muted">Últimos 15</span>
                    </div>
                    {data.shifts.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Apertura</th>
                              <th>Cierre</th>
                              <th>Base</th>
                              <th>Esperado</th>
                              <th>Contado</th>
                              <th>Diferencia</th>
                              <th>Observación</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.shifts.map((s: Row) => (
                              <tr key={s.id}>
                                <td>{date(s.opened_at)}</td>
                                <td>
                                  {s.closed_at ? (
                                    date(s.closed_at)
                                  ) : (
                                    <span className="status-badge">Abierta</span>
                                  )}
                                </td>
                                <td>{cop(s.opening)}</td>
                                <td>{s.expected !== null ? cop(s.expected) : '—'}</td>
                                <td>{s.counted !== null ? cop(s.counted) : '—'}</td>
                                <td className={s.difference ? 'negative' : 'positive'}>
                                  {s.difference !== null ? cop(s.difference) : '—'}
                                </td>
                                <td>{s.note || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty
                        title="Todavía no hay turnos"
                        text="Comienza abriendo la primera caja."
                        icon={<Wallet size={25} />}
                      />
                    )}
                  </section>
                </>
              )}
              {screen === 'reports' && (
                <>
                  <section className="panel padded">
                    <form className="report-controls" onSubmit={loadReport}>
                      <div>
                        <label htmlFor="from">Desde</label>
                        <input
                          id="from"
                          type="date"
                          value={from}
                          onChange={(e) => setFrom(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="to">Hasta</label>
                        <input
                          id="to"
                          type="date"
                          value={to}
                          onChange={(e) => setTo(e.target.value)}
                          required
                        />
                      </div>
                      <button type="submit" className="primary" disabled={busy}>
                        Consultar
                        <ArrowRight size={17} />
                      </button>
                      <span className="muted">Fechas de Colombia · Máximo 93 días</span>
                    </form>
                  </section>
                  {report ? (
                    <>
                      <div className="stats report-stats">
                        <Stat
                          label="Total recaudado"
                          value={cop(report.totals.total)}
                          hint={`${report.rows.length} pagos en el período`}
                          icon={<BarChart3 size={18} />}
                        />
                        {['cash', 'transfer', 'card'].map((m) => (
                          <Stat
                            key={m}
                            label={methodName[m]}
                            value={cop(report.totals[m])}
                            hint={`${report.rows.filter((r: Row) => r.method === m).length} pagos`}
                            icon={<Wallet size={18} />}
                          />
                        ))}
                      </div>
                      <section className="panel">
                        <div className="panel-title">
                          <div>
                            <h2>Pagos del período</h2>
                            <p>
                              {report.from} → {report.to} · Por fecha de pago
                            </p>
                          </div>
                          <button
                            type="button"
                            className="secondary"
                            disabled={!report.rows.length}
                            onClick={csv}
                          >
                            <Download size={16} />
                            Exportar CSV
                          </button>
                        </div>
                        {report.rows.length ? (
                          <div className="table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>Placa</th>
                                  <th>Tipo</th>
                                  <th>Entrada</th>
                                  <th>Salida</th>
                                  <th>Medio</th>
                                  <th>Total</th>
                                  <th>Recibo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.rows.map((r: Row) => (
                                  <tr key={r.id}>
                                    <td className="plate">{r.plate}</td>
                                    <td>{r.type === 'car' ? 'Carro' : 'Moto'}</td>
                                    <td>{date(r.entry_at)}</td>
                                    <td>{date(r.exit_at)}</td>
                                    <td>{methodName[r.method]}</td>
                                    <td className="money">{cop(r.total)}</td>
                                    <td>
                                      <button
                                        type="button"
                                        className="icon-button"
                                        aria-label={`Recibo ${r.plate}`}
                                        onClick={() => viewReceipt(r.id)}
                                      >
                                        <Printer size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <Empty
                            title="Sin pagos en estas fechas"
                            text="Prueba con otro rango o registra tu primer cobro."
                            icon={<BarChart3 size={25} />}
                          />
                        )}
                      </section>
                    </>
                  ) : (
                    <section className="panel recent-panel">
                      <Empty
                        title="Tu operación, en números"
                        text="Selecciona las fechas y pulsa Consultar para ver los pagos por medio de pago."
                        icon={<BarChart3 size={28} />}
                      />
                    </section>
                  )}
                </>
              )}
              {screen === 'settings' && (
                <SettingsForm
                  config={data.config}
                  busy={busy}
                  onSave={(config) =>
                    void run({ action: 'settings', config }, () =>
                      setToast('Configuración guardada. Aplica a las nuevas entradas.'),
                    )
                  }
                />
              )}
              <footer className="app-footer">
                <span>Hecho para una operación más simple.</span>
                <span>
                  <MapPin size={12} />
                  {data.config.city} · COP
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {entryModal && data && (
        <Modal error={error} title="Nueva entrada" busy={busy} onClose={() => setEntryModal(false)}>
          <EntryForm config={data.config} busy={busy} onEnter={enter} />
        </Modal>
      )}
      {quote && data && (
        <Modal
          error={error}
          title="Cobrar y registrar salida"
          busy={busy}
          onClose={() => setQuote(null)}
        >
          <div className="payment-vehicle">
            <span className="vehicle-icon">{quote.stay.type === 'car' ? <Car /> : <Bike />}</span>
            <div>
              <h3 className="plate">{quote.stay.plate}</h3>
              <p>Ingreso: {date(quote.stay.entry_at)}</p>
            </div>
          </div>
          <div className="payment-total">
            <span>Total a pagar</span>
            <strong>{cop(quote.total)}</strong>
            <small>
              {duration(quote.elapsedMinutes)} · {quote.blocks} bloques de{' '}
              {quote.stay.rate.blockMinutes} min
            </small>
          </div>
          <p className="quote-expiry">
            {now > quote.expiresAt
              ? 'Cotización vencida. Actualiza para continuar.'
              : `Valor reservado por ${Math.min(60, Math.max(0, Math.ceil((quote.expiresAt - now) / 1000)))} segundos.`}
          </p>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                { action: 'pay', quoteId: quote.id, method, tendered: Number(tendered) },
                (r) => {
                  setQuote(null);
                  setReceipt(r);
                  setToast('Pago confirmado. Salida registrada.');
                },
              );
            }}
          >
            <label htmlFor="payment-method">Medio de pago</label>
            <select id="payment-method" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
            </select>
            {method === 'cash' && (
              <>
                <label htmlFor="tendered">Efectivo recibido en COP</label>
                <input
                  id="tendered"
                  type="number"
                  min={quote.total}
                  step="1"
                  max="100000000"
                  required
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                />
                <div className="change">
                  <span>Cambio a entregar</span>
                  <b>{cop(Math.max(0, Number(tendered) - quote.total))}</b>
                </div>
              </>
            )}
            {method !== 'cash' && (
              <p className="muted">
                Verifica el pago en el banco o datáfono antes de confirmar. Este registro no procesa
                el pago.
              </p>
            )}
            {!data.shift && <p className="negative">Abre caja para poder cobrar.</p>}
            <button
              type="submit"
              className="primary full"
              disabled={
                busy ||
                now > quote.expiresAt ||
                !data.shift ||
                (method === 'cash' && Number(tendered) < quote.total)
              }
            >
              <Check size={18} />
              Confirmar pago y salida
            </button>
            <button
              className="secondary full"
              type="button"
              disabled={busy}
              onClick={() => getQuote(quote.stay.id)}
            >
              <RefreshCw size={16} />
              Actualizar cobro
            </button>
          </form>
        </Modal>
      )}
      {receipt && (
        <Modal
          error={error}
          title={receipt.payment ? 'Pago confirmado' : 'Entrada registrada'}
          busy={busy}
          onClose={() => setReceipt(null)}
        >
          <Receipt value={receipt} />
          <button
            type="button"
            className="primary full print-button"
            onClick={() => window.print()}
          >
            <Printer size={18} />
            Imprimir comprobante
          </button>
        </Modal>
      )}
      {closeConfirm && data && (
        <Modal
          error={error}
          title="Confirmar cierre de caja"
          busy={busy}
          onClose={() => setCloseConfirm(null)}
        >
          <div className="stack">
            <p>El cierre guardará el conteo y bloqueará nuevos cobros en este turno.</p>
            <div className="change">
              <span>Efectivo esperado ahora</span>
              <b>{cop(data.shift?.current_expected ?? 0)}</b>
            </div>
            <div className="change">
              <span>Efectivo contado</span>
              <b>{cop(closeConfirm.counted)}</b>
            </div>
            <p className="muted">
              El servidor calculará el saldo definitivo al cerrar, incluyendo cualquier pago
              registrado mientras contabas.
            </p>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() =>
                void run({ action: 'closeShift', ...closeConfirm }, (s) => {
                  setCloseConfirm(null);
                  setToast(`Caja cerrada. Diferencia: ${cop(s.difference)}`);
                })
              }
            >
              Confirmar cierre
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SettingsForm({
  config,
  busy,
  onSave,
}: {
  config: Row;
  busy: boolean;
  onSave: (config: Row) => void;
}) {
  return (
    <form
      key={JSON.stringify(config)}
      onSubmit={(e) => {
        const v = formValues(e);
        const rates: Row = {};
        for (const t of ['car', 'motorcycle'])
          rates[t] = {
            blockMinutes: Number(v[`${t}_minutes`]),
            blockPrice: Number(v[`${t}_price`]),
            graceMinutes: Number(v[`${t}_grace`]),
          };
        onSave({
          name: v.name,
          city: v.city,
          address: v.address,
          nit: v.nit,
          policy: v.policy,
          insurer: v.insurer,
          claims: v.claims,
          rates,
        });
      }}
    >
      <div className="two-columns">
        <section className="panel padded">
          <div className="section-number">
            01 <span>EL PARQUEADERO</span>
          </div>
          <h2>Información del negocio</h2>
          <p className="muted">
            Estos datos se incluyen en los comprobantes de las nuevas entradas.
          </p>
          <div className="stack">
            {[
              ['name', 'Nombre del parqueadero', 100],
              ['city', 'Municipio', 100],
              ['address', 'Dirección', 180],
              ['nit', 'NIT', 40],
              ['insurer', 'Aseguradora', 120],
              ['policy', 'Número de póliza', 100],
            ].map(([n, l, max]) => (
              <div className="field" key={n}>
                <label htmlFor={String(n)}>{l}</label>
                <input
                  id={String(n)}
                  name={String(n)}
                  defaultValue={config[n]}
                  maxLength={Number(max)}
                  required={n === 'name' || n === 'city'}
                />
              </div>
            ))}
            <label htmlFor="claims">Contacto y procedimiento de reclamación</label>
            <textarea
              id="claims"
              name="claims"
              defaultValue={config.claims}
              maxLength={500}
              rows={3}
            />
          </div>
        </section>
        <section className="panel padded">
          <div className="section-number">
            02 <span>TARIFAS</span>
          </div>
          <h2>Cobro por bloques iniciados</h2>
          <p className="muted">
            Valores en pesos colombianos. Las tarifas actuales son ejemplos editables.
          </p>
          {['car', 'motorcycle'].map((t) => (
            <div className="rate-config" key={t}>
              <h3>
                {t === 'car' ? <Car size={20} /> : <Bike size={20} />}
                {t === 'car' ? 'Carros' : 'Motos'}
              </h3>
              <div className="stack">
                <label htmlFor={`${t}_minutes`}>Duración del bloque</label>
                <select
                  id={`${t}_minutes`}
                  name={`${t}_minutes`}
                  defaultValue={config.rates[t].blockMinutes}
                >
                  {[1, 15, 30, 60].map((m) => (
                    <option value={m} key={m}>
                      {m === 60 ? '1 hora' : `${m} minutos`}
                    </option>
                  ))}
                </select>
                <label htmlFor={`${t}_price`}>Precio por bloque en COP</label>
                <input
                  id={`${t}_price`}
                  name={`${t}_price`}
                  defaultValue={config.rates[t].blockPrice}
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  required
                />
                <label htmlFor={`${t}_grace`}>Tolerancia gratuita en minutos</label>
                <input
                  id={`${t}_grace`}
                  name={`${t}_grace`}
                  defaultValue={config.rates[t].graceMinutes}
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  required
                />
              </div>
            </div>
          ))}
          <div className="notice small">
            Si la estadía supera la tolerancia, se cobra todo el tiempo por bloques iniciados. Ej.:
            61 minutos, sin tolerancia, equivalen a 2 horas.
          </div>
        </section>
      </div>
      <div className="settings-save">
        <p>Los cambios aplican únicamente a entradas nuevas.</p>
        <button type="submit" className="primary" disabled={busy}>
          <Check size={17} />
          Guardar configuración
        </button>
      </div>
    </form>
  );
}
