export function normalizePlate(value, type) {
  const plate = String(value ?? '')
    .toUpperCase()
    .replace(/[\s-]/g, '');
  const valid =
    type === 'car' ? /^[A-Z]{3}\d{3}$/.test(plate) : /^[A-Z]{3}\d{2}[A-Z]?$/.test(plate);
  if (!valid)
    throw new Error(
      type === 'car' ? 'Placa de carro: usa ABC123.' : 'Placa de moto: usa ABC12D o ABC12.',
    );
  return plate;
}
export function calculateCharge(entryAt, at, rate) {
  if (!Number.isSafeInteger(entryAt) || !Number.isSafeInteger(at) || at < entryAt)
    throw new Error('Intervalo de tiempo inválido.');
  if (
    !rate ||
    ![1, 15, 30, 60].includes(rate.blockMinutes) ||
    !Number.isSafeInteger(rate.blockPrice) ||
    rate.blockPrice < 1 ||
    rate.blockPrice > 1000000 ||
    !Number.isInteger(rate.graceMinutes) ||
    rate.graceMinutes < 0 ||
    rate.graceMinutes > 60
  )
    throw new Error('Tarifa inválida.');
  const elapsedMs = at - entryAt;
  // La tolerancia exonera estadías cortas; no descuenta minutos a las demás.
  const blocks =
    elapsedMs <= rate.graceMinutes * 60000 ? 0 : Math.ceil(elapsedMs / (rate.blockMinutes * 60000));
  const total = blocks * rate.blockPrice;
  if (!Number.isSafeInteger(total)) throw new Error('El valor excede el límite permitido.');
  return { elapsedMinutes: Math.ceil(elapsedMs / 60000), blocks, total };
}
export function bogotaDay(at = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}
export const defaultSettings = {
  name: 'Mi parqueadero',
  city: 'El Retiro, Antioquia',
  address: '',
  nit: '',
  policy: '',
  insurer: '',
  claims: '',
  rates: {
    car: { blockMinutes: 60, blockPrice: 4000, graceMinutes: 0 },
    motorcycle: { blockMinutes: 60, blockPrice: 2000, graceMinutes: 0 },
  },
};
