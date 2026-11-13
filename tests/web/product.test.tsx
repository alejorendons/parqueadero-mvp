import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ParkingApp from '../../app/parking-app';
import {
  ApiError,
  fetchState,
  fetchReceipt,
  fetchReport,
  sendCommand,
} from '../../app/parking/api';
import { state, stay, quote, receipt, report, now, config } from './fixtures';
vi.mock('../../app/parking/api', async (original) => ({
  ...(await original<typeof import('../../app/parking/api')>()),
  fetchState: vi.fn(),
  fetchReceipt: vi.fn(),
  fetchReport: vi.fn(),
  sendCommand: vi.fn(),
}));

const open = async () => {
  render(<ParkingApp operator="Operador" initialNow={now} />);
  await screen.findByRole('heading', { name: 'Vehículos en parqueadero' });
  return userEvent.setup();
};
const nav = (name: string) =>
  within(screen.getByRole('navigation')).getByRole('button', { name: new RegExp(name) });
beforeEach(() => {
  vi.mocked(fetchState).mockReset().mockResolvedValue(structuredClone(state));
  vi.mocked(sendCommand).mockReset();
  vi.mocked(fetchReceipt).mockReset().mockResolvedValue(receipt);
  vi.mocked(fetchReport).mockReset().mockResolvedValue(report);
});

describe('trabajo de operación', () => {
  it('registra una moto, muestra el recibo y permite imprimirlo sin enviar el formulario al cambiar de tipo', async () => {
    const user = await open();
    vi.mocked(sendCommand).mockResolvedValue({ ...stay, type: 'motorcycle', plate: 'ABC12D' });
    await user.click(screen.getByRole('button', { name: 'Moto' }));
    expect(sendCommand).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Placa', { exact: true }), 'abc12d');
    await user.click(screen.getByRole('button', { name: 'Sin novedades visibles' }));
    await user.click(screen.getByRole('button', { name: 'Registrar entrada' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Entrada guardada')).toBeTruthy();
    expect(sendCommand).toHaveBeenCalledWith({
      action: 'enter',
      plate: 'ABC12D',
      type: 'motorcycle',
      vehicleState: 'Sin novedades visibles',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Imprimir comprobante' }));
    expect(window.print).toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar ventana' }));
    expect((screen.getByLabelText('Placa', { exact: true }) as HTMLInputElement).value).toBe('');
  });
  it('muestra una placa inválida y conserva el formulario cuando el servidor rechaza un duplicado', async () => {
    const user = await open();
    await user.type(screen.getByLabelText('Placa', { exact: true }), '12');
    await user.click(screen.getByRole('button', { name: 'Sin novedades visibles' }));
    await user.click(screen.getByRole('button', { name: 'Registrar entrada' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Placa de carro/);
    expect(sendCommand).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Placa', { exact: true }));
    await user.type(screen.getByLabelText('Placa', { exact: true }), 'ABC123');
    vi.mocked(sendCommand).mockRejectedValue(
      new ApiError('La placa ya tiene una estadía activa.', 409),
    );
    await user.click(screen.getByRole('button', { name: 'Registrar entrada' }));
    await screen.findByText(/La placa ya tiene/);
    expect((screen.getByLabelText('Placa', { exact: true }) as HTMLInputElement).value).toBe(
      'ABC123',
    );
  });
  it('busca una placa y cobra en efectivo con cambio; termina en un comprobante verificable', async () => {
    const user = await open();
    vi.mocked(sendCommand).mockResolvedValueOnce(quote).mockResolvedValueOnce(receipt);
    await user.type(
      screen.getByRole('textbox', { name: 'Buscar placa para cobrar' }),
      'abc123{Enter}',
    );
    const dialog = await screen.findByRole('dialog', { name: 'Cobrar y registrar salida' });
    const received = within(dialog).getByLabelText('Efectivo recibido · COP');
    await user.clear(received);
    await user.type(received, '10000');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar pago y salida' }));
    const result = await screen.findByRole('dialog', { name: 'Comprobante de pago' });
    expect(within(result).getByText('Pago y salida guardados')).toBeTruthy();
    expect(sendCommand).toHaveBeenLastCalledWith({
      action: 'pay',
      quoteId: quote.id,
      method: 'cash',
      tendered: 10000,
    });
    expect(within(result).getByText(/Pago payment-1/)).toBeTruthy();
  });
  it('una búsqueda sin resultados ofrece registrar esa placa y los filtros siguen siendo útiles', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: /Motos/ }));
    expect(screen.getByRole('heading', { name: 'No hay vehículos en este filtro' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Todos/ }));
    await user.type(screen.getByRole('textbox', { name: 'Buscar placa para cobrar' }), 'XYZ789');
    await user.click(screen.getByRole('button', { name: 'Registrar entrada con esta placa' }));
    expect((screen.getByLabelText('Placa', { exact: true }) as HTMLInputElement).value).toBe(
      'XYZ789',
    );
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(screen.getByRole('button', { name: 'Cobrar ABC123' })).toBeTruthy();
  });
  it('recupera comprobantes de pagos anteriores y muestra errores de consulta', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Ver comprobante ABC123' }));
    await screen.findByRole('dialog', { name: 'Comprobante de pago' });
    expect(fetchReceipt).toHaveBeenCalledWith('payment-1');
    await user.click(screen.getByRole('button', { name: 'Cerrar ventana' }));
    vi.mocked(fetchReceipt).mockRejectedValue(new Error('Comprobante no disponible'));
    await user.click(screen.getByRole('button', { name: 'Ver comprobante ABC123' }));
    await screen.findByText('Comprobante no disponible');
  });
  it('conserva datos al perder conexión y bloquea cambios hasta recuperar la consulta', async () => {
    const user = await open();
    vi.mocked(fetchState).mockRejectedValueOnce(new ApiError('Sin conexión'));
    await user.click(screen.getByRole('button', { name: 'Actualizar datos' }));
    await screen.findByText('Sin conexión');
    expect(
      (screen.getByRole('button', { name: 'Cobrar ABC123' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(screen.queryByText('Sin conexión')).toBeNull());
    expect(
      (screen.getByRole('button', { name: 'Cobrar ABC123' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
  it('permite entrar sin caja abierta y guía hacia la apertura para cobrar', async () => {
    vi.mocked(fetchState).mockResolvedValue({ ...state, shift: null });
    const user = await open();
    expect(screen.getByText('Abre caja para registrar cobros.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Ir a caja' }));
    await screen.findByRole('heading', { name: 'Preparar caja' });
    vi.mocked(sendCommand).mockResolvedValue(state.shift);
    await user.type(screen.getByLabelText('Base inicial · COP'), '50000');
    await user.click(screen.getByRole('button', { name: 'Abrir turno' }));
    await waitFor(() =>
      expect(sendCommand).toHaveBeenCalledWith({ action: 'openShift', opening: 50000 }),
    );
  });
});

describe('navegación y configuración', () => {
  it('protege cambios sin guardar al navegar y mantiene el formulario durante un refresco', async () => {
    const user = await open();
    await user.click(nav('Tarifas y datos'));
    const name = screen.getByLabelText('Nombre del parqueadero');
    await user.clear(name);
    await user.type(name, 'Parqueadero del Retiro');
    await user.click(screen.getByRole('button', { name: 'Actualizar datos' }));
    await waitFor(() => expect((name as HTMLInputElement).value).toBe('Parqueadero del Retiro'));
    await user.click(nav('Caja'));
    await screen.findByRole('dialog', { name: 'Tienes cambios sin guardar' });
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect((name as HTMLInputElement).value).toBe('Parqueadero del Retiro');
    await user.click(nav('Reportes'));
    await user.click(screen.getByRole('button', { name: 'Descartar y salir' }));
    await screen.findByRole('heading', { name: 'Reportes', level: 1 });
    await user.click(nav('Tarifas y datos'));
    expect((screen.getByLabelText('Nombre del parqueadero') as HTMLInputElement).value).toBe(
      config.name,
    );
  });
  it('guarda configuración validada y deja constancia del resultado', async () => {
    const user = await open();
    await user.click(nav('Tarifas y datos'));
    const prices = screen.getAllByLabelText('Precio del bloque · COP');
    await user.clear(prices[0]);
    await user.type(prices[0], '5000');
    vi.mocked(sendCommand).mockResolvedValue({
      ...config,
      rates: { ...config.rates, car: { ...config.rates.car, blockPrice: 5000 } },
    });
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText(/Guardado a las/);
    expect(sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'settings',
        config: expect.objectContaining({
          rates: expect.objectContaining({ car: expect.objectContaining({ blockPrice: 5000 }) }),
        }),
      }),
    );
    expect(
      (screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
  it('una carga inicial fallida ofrece recuperación y una sesión vencida tiene salida clara', async () => {
    vi.mocked(fetchState).mockRejectedValueOnce(new ApiError('Vuelve a iniciar sesión.', 401));
    render(<ParkingApp operator="Operador" initialNow={now} />);
    await screen.findByText('La sesión terminó');
    expect(screen.getByRole('link', { name: /Volver a iniciar/ }).getAttribute('href')).toMatch(
      /signin-with-chatgpt/,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await screen.findByRole('heading', { name: 'Vehículos en parqueadero' });
  });
  it('descarta lecturas antiguas cuando un refresco más reciente ya terminó', async () => {
    let resolveOld!: (value: typeof state) => void;
    vi.mocked(fetchState).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    render(<ParkingApp operator="Operador" initialNow={now} />);
    await waitFor(() => expect(fetchState).toHaveBeenCalledTimes(1));
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await screen.findByRole('heading', { name: 'Vehículos en parqueadero' });
    await act(async () => {
      resolveOld({ ...state, config: { ...config, name: 'Respuesta obsoleta' } });
    });
    expect(screen.queryByText('Respuesta obsoleta')).toBeNull();
  });
});
