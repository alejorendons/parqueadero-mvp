import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentPanel } from '../../app/parking/payment';
import { Cash } from '../../app/parking/cash';
import { Reports } from '../../app/parking/reports';
import { Settings } from '../../app/parking/settings';
import { Operation } from '../../app/parking/operation';
import { Dialog } from '../../app/parking/ui';
import { fetchReport } from '../../app/parking/api';
import { config, now, quote, report, state, shift } from './fixtures';
vi.mock('../../app/parking/api', async (original) => ({
  ...(await original<typeof import('../../app/parking/api')>()),
  fetchReport: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(fetchReport).mockReset().mockResolvedValue(report);
});

it('exige verificar el pago digital, permite volver a efectivo y bloquea una cotización vencida', async () => {
  const onPay = vi.fn().mockResolvedValue(true),
    refresh = vi.fn(),
    openCash = vi.fn();
  const props = {
    quote,
    now,
    hasShift: true,
    busy: false,
    error: null,
    onPay,
    onRefresh: refresh,
    openCash,
  };
  const user = userEvent.setup();
  const { rerender } = render(<PaymentPanel {...props} />);
  const confirm = screen.getByRole('button', { name: 'Confirmar pago y salida' });
  await user.click(screen.getByRole('radio', { name: 'Transferencia' }));
  expect((confirm as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole('checkbox'));
  await user.click(confirm);
  expect(onPay).toHaveBeenCalledWith({ quoteId: quote.id, method: 'transfer', tendered: 4000 });
  await user.click(screen.getByRole('radio', { name: 'Tarjeta' }));
  expect((confirm as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole('radio', { name: 'Efectivo' }));
  const received = screen.getByLabelText('Efectivo recibido · COP');
  await user.clear(received);
  await user.type(received, '1000');
  expect((confirm as HTMLButtonElement).disabled).toBe(true);
  rerender(<PaymentPanel {...props} now={now + 60001} />);
  expect(screen.getByText('El valor reservado venció.')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Actualizar valor' }));
  expect(refresh).toHaveBeenCalled();
  rerender(<PaymentPanel {...props} hasShift={false} />);
  await user.click(screen.getByRole('button', { name: 'Abrir caja' }));
  expect(openCash).toHaveBeenCalled();
});

it('reutiliza la referencia de movimiento al reintentar y solo limpia después de confirmar', async () => {
  const onMove = vi.fn().mockResolvedValue(true).mockResolvedValueOnce(false);
  const props = {
    data: state,
    pending: null,
    offline: false,
    error: null,
    onOpen: vi.fn(),
    onMove,
    onClose: vi.fn(),
    clearError: vi.fn(),
  };
  const user = userEvent.setup();
  render(<Cash {...props} />);
  await user.type(screen.getByLabelText('Valor · COP'), '10000');
  await user.type(screen.getByLabelText('Motivo'), 'Consignación');
  await user.click(screen.getByRole('button', { name: 'Registrar movimiento' }));
  await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
  expect((screen.getByLabelText('Motivo') as HTMLInputElement).value).toBe('Consignación');
  await user.click(screen.getByRole('button', { name: 'Registrar movimiento' }));
  await waitFor(() => expect(onMove).toHaveBeenCalledTimes(2));
  expect(onMove.mock.calls[0][0].requestId).toBe(onMove.mock.calls[1][0].requestId);
  expect((screen.getByLabelText('Motivo') as HTMLInputElement).value).toBe('');
  await user.selectOptions(screen.getByLabelText('Tipo de movimiento'), 'in');
  await user.type(screen.getByLabelText('Valor · COP'), '5000');
  await user.type(screen.getByLabelText('Motivo'), 'Cambio');
  await user.click(screen.getByRole('button', { name: 'Registrar movimiento' }));
  expect(onMove).toHaveBeenLastCalledWith(
    expect.objectContaining({ direction: 'in', amount: 5000 }),
  );
  expect(onMove.mock.calls[2][0].requestId).not.toBe(onMove.mock.calls[0][0].requestId);
});

it('revisa el conteo antes de cerrar caja y presenta el cierre definitivo del servidor', async () => {
  const closed = {
    ...shift,
    closed_at: now,
    counted: 53500,
    expected: 54000,
    difference: -500,
    note: 'Diferencia',
    closed_by: 'Operador',
  };
  const close = vi.fn().mockResolvedValue(closed);
  const user = userEvent.setup();
  render(
    <Cash
      data={state}
      pending={null}
      offline={false}
      error={null}
      onOpen={vi.fn()}
      onMove={vi.fn()}
      onClose={close}
      clearError={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText('Efectivo contado · COP'), '53500');
  await user.type(screen.getByLabelText('Observaciones del cierre'), 'Diferencia');
  await user.click(screen.getByRole('button', { name: 'Revisar cierre' }));
  expect(close).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }));
  await screen.findByText('Turno cerrado y guardado.');
  expect(close).toHaveBeenCalledWith(
    expect.objectContaining({ shiftId: shift.id, counted: 53500, note: 'Diferencia' }),
  );
  await user.click(screen.getByRole('button', { name: 'Ver cierre' }));
  const detail = screen.getByRole('dialog', { name: 'Detalle del turno' });
  expect(within(detail).getByText('Diferencia', { selector: 'dt' })).toBeTruthy();
  await user.click(within(detail).getByRole('button', { name: 'Cerrar ventana' }));
});

it('consulta fechas aplicadas, exporta el período completo y recupera errores del reporte', async () => {
  const onReceipt = vi.fn();
  const user = userEvent.setup();
  render(<Reports now={now} onReceipt={onReceipt} />);
  await user.click(screen.getByRole('button', { name: 'Hoy' }));
  await screen.findByRole('heading', { name: 'Detalle de pagos' });
  expect(fetchReport).toHaveBeenCalledWith('2026-11-13', '2026-11-13');
  await user.click(screen.getByRole('button', { name: 'Comprobante ABC123' }));
  expect(onReceipt).toHaveBeenCalledWith('payment-1');
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await user.click(screen.getByRole('button', { name: 'Exportar período' }));
  expect(click).toHaveBeenCalled();
  expect(URL.createObjectURL).toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-01' } });
  expect(screen.getByText(/Cambiaste las fechas/)).toBeTruthy();
  vi.mocked(fetchReport).mockRejectedValueOnce(new Error('Rango inválido'));
  await user.click(screen.getByRole('button', { name: 'Consultar período' }));
  await screen.findByText('Rango inválido');
  vi.mocked(fetchReport).mockResolvedValueOnce({ ...report, from: '2026-11-01', rows: [] });
  await user.click(screen.getByRole('button', { name: 'Actualizar' }));
  await screen.findByText('Sin pagos en este período');
  await user.click(screen.getByRole('button', { name: 'Últimos 7 días' }));
  await waitFor(() => expect(fetchReport).toHaveBeenLastCalledWith('2026-11-07', '2026-11-13'));
  await user.click(screen.getByRole('button', { name: 'Este mes' }));
  await waitFor(() => expect(fetchReport).toHaveBeenLastCalledWith('2026-11-01', '2026-11-13'));
});

it('el reporte pagina sin perder el período que se exporta', async () => {
  vi.mocked(fetchReport).mockResolvedValue({
    ...report,
    rows: Array.from({ length: 26 }, (_, i) => ({
      ...report.rows[0],
      id: `p${i}`,
      plate: `ABC${String(i).padStart(3, '0')}`,
    })),
  });
  const user = userEvent.setup();
  render(<Reports now={now} onReceipt={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Hoy' }));
  await screen.findByRole('heading', { name: 'Detalle de pagos' });
  await user.click(screen.getByRole('button', { name: 'Pagos siguientes' }));
  expect(screen.getByText('ABC025')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Pagos anteriores' }));
  expect(screen.getByText('ABC000')).toBeTruthy();
});

it('configura bloques, tolerancia y datos del negocio, y protege la salida del navegador', async () => {
  const save = vi.fn().mockResolvedValue(undefined),
    dirty = vi.fn();
  const user = userEvent.setup();
  render(
    <Settings
      config={config}
      now={now}
      busy={false}
      offline={false}
      onSave={save}
      onDirty={dirty}
    />,
  );
  await user.selectOptions(screen.getAllByLabelText('Duración del bloque')[1], '15');
  const grace = screen.getAllByLabelText('Tolerancia gratuita · min')[1];
  await user.clear(grace);
  await user.type(grace, '5');
  await user.type(screen.getByLabelText('Dirección'), 'Calle 1');
  await user.type(
    screen.getByLabelText('Contacto y procedimiento de reclamación'),
    'Administración',
  );
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        address: 'Calle 1',
        claims: 'Administración',
        rates: expect.objectContaining({
          motorcycle: { blockMinutes: 15, graceMinutes: 5, blockPrice: 2000 },
        }),
      }),
    ),
  );
  expect(screen.getByText('Tienes cambios sin guardar')).toBeTruthy();
});

it('la operación pagina, permite reimprimir entradas y presenta estadías largas sin inventar capacidad', async () => {
  const entryReceipt = vi.fn(),
    charge = vi.fn();
  const user = userEvent.setup();
  render(
    <Operation
      data={{
        ...state,
        active: Array.from({ length: 21 }, (_, i) => ({
          ...state.active[0],
          id: `s${i}`,
          plate: `ABC${String(i).padStart(3, '0')}`,
          entry_at: now - (i + 1) * 86400000,
        })),
      }}
      now={now}
      busy={false}
      offline={false}
      onEnter={vi.fn()}
      onCharge={charge}
      onEntryReceipt={entryReceipt}
      onPaymentReceipt={vi.fn()}
      openCash={vi.fn()}
      openReports={vi.fn()}
    />,
  );
  expect(screen.getAllByText('Más de un día').length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
  await user.click(screen.getByRole('button', { name: 'Recibo de entrada ABC000' }));
  expect(entryReceipt).toHaveBeenCalledWith(expect.objectContaining({ id: 's0' }));
  await user.click(screen.getByRole('button', { name: 'Cobrar ABC000' }));
  expect(charge).toHaveBeenCalledWith('s0');
  await user.click(screen.getByRole('button', { name: 'Página anterior' }));
  fireEvent.keyDown(document, { key: '/' });
  expect(document.activeElement).toBe(
    screen.getByRole('textbox', { name: 'Buscar placa para cobrar' }),
  );
});

it('un diálogo respeta Escape durante un envío y devuelve el foco al control de origen', () => {
  const close = vi.fn();
  const trigger = document.createElement('button');
  document.body.appendChild(trigger);
  trigger.focus();
  const { rerender, unmount } = render(
    <Dialog title="Revisar" busy onClose={close}>
      Datos
    </Dialog>,
  );
  const dialog = screen.getByRole('dialog');
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(close).not.toHaveBeenCalled();
  rerender(
    <Dialog title="Revisar" onClose={close}>
      Datos
    </Dialog>,
  );
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(close).toHaveBeenCalled();
  unmount();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});
