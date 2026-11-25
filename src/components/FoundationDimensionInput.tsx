import React, { createContext, useContext, useState } from 'react';
import { displayFoundationDimension, parseFoundationDimension, type FoundationUnit } from '../engine/measurements/foundationUnits';

export const FoundationMetricContext = createContext(false);

interface Props {
  key?: string;
  label: string;
  value: string;
  onChange: (feet: string) => void;
  className: string;
  section?: boolean;
  metric?: boolean;
  hint?: string;
  accessibleLabel?: string;
}

/** The parent owns canonical feet. Unedited display rounding never feeds a save. */
export function FoundationDimensionInput({ label, value, onChange, className, section, metric, hint, accessibleLabel }: Props) {
  const contextMetric = useContext(FoundationMetricContext);
  const useMetric = metric ?? contextMetric;
  const unit: FoundationUnit = section ? (useMetric ? 'mm' : 'in') : (useMetric ? 'm' : 'ft');
  const [edit, setEdit] = useState<{ text: string; canonical: string; unit: FoundationUnit }>();
  const text = edit?.canonical === value && edit.unit === unit
    ? edit.text
    : value && Number.isFinite(Number(value)) ? displayFoundationDimension(Number(value), unit) : '';
  const suffix = ` (${unit}${hint ? '; ' + hint : ''})`;

  return <label className="block">
    {label}{suffix}
    <input aria-label={(accessibleLabel ?? label) + suffix} className={className} inputMode="text" value={text} onChange={event => {
      const text = event.target.value;
      const feet = parseFoundationDimension(text, unit);
      const canonical = text.trim() ? (feet === null ? 'invalid' : String(feet)) : '';
      setEdit({ text, canonical, unit });
      onChange(canonical);
    }}/>
  </label>;
}
