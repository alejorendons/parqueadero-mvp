const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});
const shortDate = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const fullDate = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
const clock = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
/** @param {number} value */
export const money = (value) => currency.format(value);
/** @param {number} value */
export const dateTime = (value) => shortDate.format(value);
/** @param {number} value */
export const receiptDate = (value) => fullDate.format(value);
/** @param {number} value */
export const time = (value) => clock.format(value);
/** @param {number} value */
export const duration = (value) => {
  const minutes = Math.max(0, Math.ceil(value));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};
export const methods = { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta' };
export const vehicleNames = { car: 'Carro', motorcycle: 'Moto' };
/** @param {import('../../domain/parking-types').Rate} rate */
export const rateLabel = (rate) =>
  `${money(rate.blockPrice)} / ${rate.blockMinutes === 60 ? 'hora' : `${rate.blockMinutes} min`} o fracción`;
/** @param {unknown} value */
export function csvCell(value) {
  const text = String(value ?? '');
  const safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
/** @param {import('../../domain/parking-types').Report} report */
export function reportCsv(report) {
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
    ...report.rows.map((r) => [
      r.id,
      r.plate,
      vehicleNames[r.type],
      receiptDate(r.entry_at),
      receiptDate(r.exit_at),
      methods[r.method],
      r.total,
      r.tendered,
      r.change,
      r.shift_id,
    ]),
  ];
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}
/** @param {import('../../domain/parking-types').Report} report */
export function downloadReport(report) {
  const url = URL.createObjectURL(
    new Blob([reportCsv(report)], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `pagos-${report.from}-${report.to}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
