import { useEffect, useId, useRef, useState } from 'react';
import { Bike, Car, Check, Save } from 'lucide-react';
import type { BusinessSettings, VehicleType } from '../../domain/parking-types';
import { Button, Field, Notice, Panel, SectionTitle } from './ui';
import { money, time } from './format.mjs';

type RateDraft = { blockMinutes: number; blockPrice: string; graceMinutes: string };
type Draft = Omit<BusinessSettings, 'rates'> & { rates: Record<VehicleType, RateDraft> };
function toDraft(config: BusinessSettings): Draft {
  return {
    ...config,
    rates: {
      car: {
        ...config.rates.car,
        blockPrice: String(config.rates.car.blockPrice),
        graceMinutes: String(config.rates.car.graceMinutes),
      },
      motorcycle: {
        ...config.rates.motorcycle,
        blockPrice: String(config.rates.motorcycle.blockPrice),
        graceMinutes: String(config.rates.motorcycle.graceMinutes),
      },
    },
  };
}
export function Settings({
  config,
  busy,
  offline,
  now,
  onSave,
  onDirty,
}: {
  config: BusinessSettings;
  busy: boolean;
  offline: boolean;
  now: number;
  onSave: (input: BusinessSettings) => Promise<BusinessSettings | undefined>;
  onDirty: (value: boolean) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(() => toDraft(config));
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const markDirty = () => {
    dirtyRef.current = true;
    setDirty(true);
    onDirty(true);
  };
  useEffect(() => {
    if (!dirtyRef.current) setDraft(toDraft(config));
  }, [config]);
  useEffect(() => () => onDirty(false), [onDirty]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  const update = (key: Exclude<keyof Draft, 'rates'>, value: string) => {
    markDirty();
    setDraft((previous) => ({ ...previous, [key]: value }));
  };
  const updateRate = (type: VehicleType, key: keyof RateDraft, value: string) => {
    markDirty();
    setDraft((previous) => ({
      ...previous,
      rates: {
        ...previous.rates,
        [type]: { ...previous.rates[type], [key]: key === 'blockMinutes' ? Number(value) : value },
      },
    }));
  };
  return (
    <form
      className="settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        const rate = (type: VehicleType) => ({
          blockMinutes: Number(
            draft.rates[type].blockMinutes,
          ) as BusinessSettings['rates']['car']['blockMinutes'],
          blockPrice: Number(draft.rates[type].blockPrice),
          graceMinutes: Number(draft.rates[type].graceMinutes),
        });
        void onSave({ ...draft, rates: { car: rate('car'), motorcycle: rate('motorcycle') } }).then(
          (result) => {
            if (result) {
              dirtyRef.current = false;
              setDirty(false);
              onDirty(false);
              setDraft(toDraft(result));
              setSavedAt(now);
            }
          },
        );
      }}
    >
      <Notice>
        <div>
          <strong>Los cambios de tarifa se aplican a entradas nuevas.</strong>
          <p>Los vehículos que ya están dentro conservan la tarifa registrada al ingresar.</p>
        </div>
      </Notice>
      <div className="settings-layout">
        <Panel>
          <SectionTitle
            title="Tarifas por vehículo"
            description="Define el precio de cada bloque de tiempo iniciado."
          />
          <div className="panel-body">
            {(['car', 'motorcycle'] as const).map((type) => (
              <div className="rate-editor" key={type}>
                <h3>
                  {type === 'car' ? <Car size={22} /> : <Bike size={22} />}{' '}
                  {type === 'car' ? 'Carros' : 'Motos'}
                </h3>
                <div className="rate-fields">
                  <Field id={`${id}-${type}-minutes`} label="Duración del bloque">
                    <select
                      id={`${id}-${type}-minutes`}
                      value={draft.rates[type].blockMinutes}
                      onChange={(e) => updateRate(type, 'blockMinutes', e.target.value)}
                    >
                      {[1, 15, 30, 60].map((m) => (
                        <option key={m} value={m}>
                          {m === 60 ? '1 hora' : `${m} minutos`}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id={`${id}-${type}-price`} label="Precio del bloque · COP">
                    <input
                      id={`${id}-${type}-price`}
                      type="number"
                      min={1}
                      max={1000000}
                      step={1}
                      required
                      value={draft.rates[type].blockPrice}
                      onChange={(e) => updateRate(type, 'blockPrice', e.target.value)}
                    />
                  </Field>
                  <Field id={`${id}-${type}-grace`} label="Tolerancia gratuita · min">
                    <input
                      id={`${id}-${type}-grace`}
                      type="number"
                      min={0}
                      max={60}
                      step={1}
                      required
                      value={draft.rates[type].graceMinutes}
                      onChange={(e) => updateRate(type, 'graceMinutes', e.target.value)}
                    />
                  </Field>
                </div>
                <p className="rate-example">
                  Ejemplo: un bloque más un minuto cuesta{' '}
                  {money(Number(draft.rates[type].blockPrice) * 2)}, si supera la tolerancia.
                </p>
              </div>
            ))}
            <div className="policy-explanation">
              <strong>Cómo se aplica la tolerancia</strong>
              <p>
                Una estadía de hasta ese tiempo es gratuita. Si lo supera, se cobra todo el tiempo
                por bloques iniciados.
              </p>
            </div>
          </div>
        </Panel>
        <Panel>
          <SectionTitle
            title="Datos del parqueadero"
            description="Se incluyen en los comprobantes de las nuevas entradas."
          />
          <div className="panel-body settings-fields">
            {(
              [
                ['name', 'Nombre del parqueadero', 100],
                ['city', 'Municipio', 100],
                ['address', 'Dirección', 180],
                ['nit', 'NIT', 40],
                ['insurer', 'Aseguradora', 120],
                ['policy', 'Número de póliza', 100],
              ] as const
            ).map(([key, label, max]) => (
              <Field key={key} id={`${id}-${key}`} label={label}>
                <input
                  id={`${id}-${key}`}
                  value={draft[key]}
                  maxLength={max}
                  required={key === 'name' || key === 'city'}
                  onChange={(e) => update(key, e.target.value)}
                />
              </Field>
            ))}
            <Field id={`${id}-claims`} label="Contacto y procedimiento de reclamación">
              <textarea
                id={`${id}-claims`}
                rows={3}
                maxLength={500}
                value={draft.claims}
                onChange={(e) => update('claims', e.target.value)}
              />
            </Field>
          </div>
        </Panel>
      </div>
      <div className="settings-save">
        <span role="status">
          {dirty ? (
            'Tienes cambios sin guardar'
          ) : savedAt ? (
            <>
              <Check size={15} />
              Guardado a las {time(savedAt)}
            </>
          ) : (
            'La configuración está al día'
          )}
        </span>
        <Button type="submit" busy={busy} disabled={!dirty || offline}>
          <Save size={17} />
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
