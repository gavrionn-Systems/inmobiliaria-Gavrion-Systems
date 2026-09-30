"use client";

import { useCallback, useRef, useState } from "react";

export const PRICE_SLIDER_STEP = 5_000;
export const DEFAULT_PRICE_STEP = 5_000;

function snap(value: number, floor: number, ceiling: number, step: number): number {
  const s = step > 0 ? step : PRICE_SLIDER_STEP;
  const snapped = Math.round(value / s) * s;
  return Math.min(ceiling, Math.max(floor, snapped));
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat(process.env.NEXT_PUBLIC_SITE_LOCALE || "es", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

type PriceRangeSliderProps = {
  floor: number;
  ceiling: number;
  valueMin: number;
  valueMax: number;
  step?: number;
  debounceMs?: number;
  onChange: (min: number | null, max: number | null) => void;
};

/** Rango doble de precio con pasos configurables (por defecto 5,000). */
export default function PriceRangeSlider({
  floor,
  ceiling,
  valueMin,
  valueMax,
  step = PRICE_SLIDER_STEP,
  debounceMs = 300,
  onChange,
}: PriceRangeSliderProps) {
  const [localMin, setLocalMin] = useState(valueMin);
  const [localMax, setLocalMax] = useState(valueMax);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = useCallback(
    (min: number, max: number) => {
      const isFullRange = min <= floor && max >= ceiling;
      if (isFullRange) {
        onChange(null, null);
        return;
      }
      onChange(min > floor ? min : null, max < ceiling ? max : null);
    },
    [floor, ceiling, onChange]
  );

  const scheduleCommit = useCallback(
    (min: number, max: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => commit(min, max), debounceMs);
    },
    [commit, debounceMs]
  );

  const flushCommit = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commit(localMin, localMax);
  }, [commit, localMin, localMax]);

  function handleMinChange(raw: number) {
    const snapped = snap(raw, floor, ceiling, step);
    const nextMin = Math.min(snapped, localMax);
    setLocalMin(nextMin);
    scheduleCommit(nextMin, localMax);
  }

  function handleMaxChange(raw: number) {
    const snapped = snap(raw, floor, ceiling, step);
    const nextMax = Math.max(snapped, localMin);
    setLocalMax(nextMax);
    scheduleCommit(localMin, nextMax);
  }

  const span = ceiling - floor || 1;
  const minPct = ((localMin - floor) / span) * 100;
  const maxPct = ((localMax - floor) / span) * 100;

  return (
    <div className="w-full pt-1">
      <span className="font-label-sm text-label-sm text-secondary mb-3 block">
        Precio
      </span>

      <div className="relative h-10 flex items-center px-1">
        <div
          aria-hidden="true"
          className="absolute inset-x-1 h-1.5 rounded-full bg-outline-variant/50"
        />
        <div
          aria-hidden="true"
          className="absolute h-1.5 rounded-full bg-primary"
          style={{
            left: `calc(${minPct}% + 4px)`,
            right: `calc(${100 - maxPct}% + 4px)`,
          }}
        />

        <input
          type="range"
          min={floor}
          max={ceiling}
          step={step}
          value={localMin}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          onPointerUp={flushCommit}
          onKeyUp={flushCommit}
          aria-label="Precio mínimo"
          aria-valuemin={floor}
          aria-valuemax={ceiling}
          aria-valuenow={localMin}
          className="price-range-input price-range-input--min"
        />
        <input
          type="range"
          min={floor}
          max={ceiling}
          step={step}
          value={localMax}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          onPointerUp={flushCommit}
          onKeyUp={flushCommit}
          aria-label="Precio máximo"
          aria-valuemin={floor}
          aria-valuemax={ceiling}
          aria-valuenow={localMax}
          className="price-range-input price-range-input--max"
        />
      </div>

      <p className="font-body-md text-body-md text-on-surface mt-1 tabular-nums">
        {formatPrice(localMin)}
        <span className="text-secondary mx-2" aria-hidden="true">
          —
        </span>
        {formatPrice(localMax)}
      </p>
    </div>
  );
}
