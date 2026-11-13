import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fetchState, sendCommand, type CommandResults } from './api';
import type { ParkingCommand, ParkingState } from '../../domain/parking-types';

export function useParking() {
  const [data, setData] = useState<ParkingState | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [actionError, setActionError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [pending, setPending] = useState<ParkingCommand['action'] | null>(null);
  const [offset, setOffset] = useState(0);
  const mounted = useRef(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const value = await fetchState(abort.signal);
      if (!mounted.current || current !== generation.current) return;
      setData(value);
      setOffset(value.now - Date.now());
      setLoadError(null);
    } catch (error) {
      if (
        !mounted.current ||
        current !== generation.current ||
        (error instanceof Error && error.name === 'AbortError')
      )
        return;
      setLoadError(error instanceof Error ? error : new Error('No pudimos actualizar los datos.'));
    } finally {
      if (mounted.current && current === generation.current) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    // Subscribe on mount. React updates happen after the awaited network response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const interval = setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh();
    }, 15000);
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      mounted.current = false;
      controller.current?.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  const perform = useCallback(
    async <C extends ParkingCommand>(
      command: C,
    ): Promise<CommandResults[C['action']] | undefined> => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(command.action);
      setActionError(null);
      try {
        const result = await sendCommand(command);
        await refresh();
        return result;
      } catch (error) {
        if (mounted.current)
          setActionError(
            error instanceof Error ? error : new Error('No pudimos guardar el cambio.'),
          );
        if (error instanceof ApiError && (error.uncertain || error.status === 409)) await refresh();
      } finally {
        inFlight.current = false;
        if (mounted.current) setPending(null);
      }
    },
    [refresh],
  );
  return {
    data,
    loadError,
    actionError,
    refreshing,
    pending,
    offset,
    refresh: async () => {
      setRefreshing(true);
      await refresh();
    },
    perform,
    clearError: () => setActionError(null),
  };
}

export function useClock(initialNow: number, offset: number) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  return now + offset;
}
