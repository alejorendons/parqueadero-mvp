import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowRight, Bike, Car, Clock3 } from 'lucide-react';
import { normalizePlate } from '../../domain/billing.mjs';
import type { BusinessSettings, EntryInput, VehicleType } from '../../domain/parking-types';
import { Button, Field } from './ui';
import { rateLabel } from './format.mjs';

export function EntryForm({
  config,
  busy,
  disabled,
  initialPlate = '',
  focused,
  onEnter,
}: {
  config: BusinessSettings;
  busy: boolean;
  disabled: boolean;
  initialPlate?: string;
  focused: boolean;
  onEnter: (input: EntryInput) => Promise<boolean>;
}) {
  const id = useId();
  const plateInput = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<VehicleType>('car');
  const [plate, setPlate] = useState(initialPlate);
  const [observation, setObservation] = useState('');
  const [plateError, setPlateError] = useState('');
  useEffect(() => {
    if (focused) plateInput.current?.focus();
  }, [focused, initialPlate]);
  const rate = config.rates[type];
  return (
    <form
      className="entry-form"
      onSubmit={(e) => {
        e.preventDefault();
        let normalized: string;
        try {
          normalized = normalizePlate(plate, type);
          setPlateError('');
        } catch (error) {
          setPlateError((error as Error).message);
          plateInput.current?.focus();
          return;
        }
        void onEnter({ plate: normalized, type, vehicleState: observation }).then((success) => {
          if (success) {
            setPlate('');
            setObservation('');
            plateInput.current?.focus();
          }
        });
      }}
    >
      <fieldset className="vehicle-choice">
        <legend>Tipo de vehículo</legend>
        <div>
          {(['car', 'motorcycle'] as const).map((v) => (
            <button
              type="button"
              key={v}
              aria-pressed={type === v}
              className={type === v ? 'selected' : ''}
              onClick={() => {
                setType(v);
                setPlateError('');
              }}
            >
              {v === 'car' ? <Car size={21} /> : <Bike size={21} />}
              {v === 'car' ? 'Carro' : 'Moto'}
            </button>
          ))}
        </div>
      </fieldset>
      <Field
        id={`${id}-plate`}
        label="Placa"
        hint={type === 'car' ? 'Tres letras y tres números. Ej. ABC123' : 'Ej. ABC12D o ABC12'}
      >
        <input
          ref={plateInput}
          id={`${id}-plate`}
          className="plate-input"
          value={plate}
          onChange={(e) => {
            setPlate(e.target.value.toUpperCase().replace(/[\s-]/g, ''));
            setPlateError('');
          }}
          maxLength={12}
          autoComplete="off"
          spellCheck={false}
          placeholder={type === 'car' ? 'ABC123' : 'ABC12D'}
          required
          aria-invalid={!!plateError}
          aria-describedby={plateError ? `${id}-error` : undefined}
        />
      </Field>
      {plateError && (
        <p className="field-error" role="alert" id={`${id}-error`}>
          {plateError}
        </p>
      )}
      <Field id={`${id}-state`} label="Estado al ingresar">
        <textarea
          id={`${id}-state`}
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          rows={2}
          maxLength={500}
          required
          placeholder="Daños visibles y objetos declarados"
        />
      </Field>
      <button
        type="button"
        className="quick-fill"
        onClick={() => setObservation('Sin novedades visibles')}
      >
        Sin novedades visibles
      </button>
      <div className="entry-rate">
        <Clock3 size={17} />
        <div>
          <strong>{rateLabel(rate)}</strong>
          <small>
            {rate.graceMinutes
              ? `${rate.graceMinutes} minutos de tolerancia`
              : 'Sin tolerancia gratuita'}
          </small>
        </div>
      </div>
      <Button type="submit" busy={busy} disabled={disabled} className="wide">
        <ArrowDownLeft size={18} />
        Registrar entrada
        <ArrowRight size={17} />
      </Button>
      <p className="field-hint">Hora automática y tarifa guardada desde el ingreso.</p>
    </form>
  );
}
