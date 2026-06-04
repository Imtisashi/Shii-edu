import { useCallback, useEffect, useRef, useState } from 'react';

type HapticStyle = 'light' | 'medium' | 'none' | 'selection';

type SingleFlightOptions = {
  cooldownMs?: number;
  disabled?: boolean;
  haptic?: HapticStyle;
};

type SingleFlightResult<TArgs extends unknown[], TResult> = {
  isPending: boolean;
  run: (...args: TArgs) => Promise<TResult | undefined>;
};

export function useSingleFlightAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult> | TResult,
  options: SingleFlightOptions = {}
): SingleFlightResult<TArgs, TResult> {
  const {
    cooldownMs = 650,
    disabled = false,
  } = options;
  const actionRef = useRef(action);
  const disabledRef = useRef(disabled);
  const inFlightRef = useRef(false);
  const lastRunAtRef = useRef(0);
  const mountedRef = useRef(true);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (...args: TArgs) => {
    const now = Date.now();

    if (
      disabledRef.current ||
      inFlightRef.current ||
      now - lastRunAtRef.current < cooldownMs
    ) {
      return undefined;
    }

    inFlightRef.current = true;
    lastRunAtRef.current = now;
    setIsPending(true);

    try {
      return await actionRef.current(...args);
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setIsPending(false);
    }
  }, [cooldownMs]);

  return {
    isPending,
    run,
  };
}

export default useSingleFlightAction;
